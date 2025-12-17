# -*- coding: utf-8 -*-
import sys
import os

# 设置标准输出编码为UTF-8
if sys.platform.startswith('win'):
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

from flask import Flask, render_template, request, jsonify, session
import json
import random
import glob
from datetime import datetime, timedelta
import secrets
import threading
import time

# 繁简转换
try:
    from opencc import OpenCC
    cc = OpenCC('t2s')  # 繁体转简体
except ImportError:
    # 如果没有opencc，使用基本的字符映射
    cc = None
    print("提示：安装 opencc-python-reimplemented 可获得更好的繁简转换效果")

app = Flask(__name__)
app.secret_key = secrets.token_hex(16)  # 用于session加密

# 房间数据存储（内存）
ROOMS = {}  # {room_id: {'data': game_data, 'last_active': datetime, 'created_at': datetime}}
ROOM_TIMEOUT = 3600  # 房间超时时间（秒），1小时无活动自动清理

# 诗词数据库（全局共享）
POETRY_DATABASE = None
CHARACTER_INDEX = None

def to_simplified(text):
    """繁体转简体"""
    if not text:
        return text
    if cc:
        return cc.convert(text)
    else:
        # 如果没有opencc，返回原文
        return text

def load_poetry_database():
    """加载诗词数据库"""
    global POETRY_DATABASE, CHARACTER_INDEX
    if POETRY_DATABASE is not None:
        return
    
    POETRY_DATABASE = []
    CHARACTER_INDEX = {}  # 字符索引：{字: [诗句索引列表]}
    
    # 扫描data目录下的所有JSON文件
    data_dir = 'data'
    json_files = glob.glob(os.path.join(data_dir, '**', '*.json'), recursive=True)
    
    # 常见的中文标点符号
    punctuation = '，。；！？、：""''（）《》【】'
    
    for json_file in json_files:
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                poems = json.load(f)
                if isinstance(poems, list):
                    for poem in poems:
                        if isinstance(poem, dict) and 'paragraphs' in poem:
                            # 过滤掉空段落
                            paragraphs = [p.strip() for p in poem['paragraphs'] if p and p.strip()]
                            if not paragraphs:
                                continue
                            
                            # 获取完整作品内容（原文-繁体）
                            full_work_traditional = '\n'.join(paragraphs)
                            # 转换为简体
                            full_work_simplified = to_simplified(full_work_traditional)
                            
                            # 处理每首诗的每一句
                            for paragraph in paragraphs:
                                # 按标点符号拆分成半句
                                # 先替换所有标点符号为统一的分隔符
                                temp_text = paragraph
                                for p in punctuation:
                                    temp_text = temp_text.replace(p, '|')
                                
                                # 按分隔符拆分
                                half_sentences = [s.strip() for s in temp_text.split('|') if s.strip()]
                                
                                # 为每个半句创建条目
                                for half_sentence in half_sentences:
                                    # 去除标点符号，只保留汉字
                                    clean_text = ''.join(c for c in half_sentence if '\u4e00' <= c <= '\u9fff')
                                    
                                    if clean_text and len(clean_text) >= 3:  # 至少3个字才算有效
                                        poem_entry = {
                                            'text': clean_text,
                                            'original': paragraph,  # 当前句（原文）
                                            'half_sentence': half_sentence,  # 当前半句（原文）
                                            'full_work': full_work_simplified,  # ✅ 完整作品（简体）
                                            'full_work_traditional': full_work_traditional,  # 完整作品（繁体原文）
                                            'title': to_simplified(poem.get('title', '')),  # 标题（简体）
                                            'author': to_simplified(poem.get('author', '')),  # 作者（简体）
                                            'dynasty': to_simplified(poem.get('dynasty', '')),  # 朝代（简体）
                                            'rhythmic': to_simplified(poem.get('rhythmic', ''))  # 词牌名（简体）
                                        }
                                        poem_index = len(POETRY_DATABASE)
                                        POETRY_DATABASE.append(poem_entry)
                                        
                                        
                                        # 建立字符索引（原文字符）
                                        for char in clean_text:
                                            if char not in CHARACTER_INDEX:
                                                CHARACTER_INDEX[char] = []
                                            CHARACTER_INDEX[char].append(poem_index)
                                        
                                        # 同时为简体字符建立索引（提高查找率）
                                        if cc:
                                            clean_text_simplified = cc.convert(clean_text)
                                            for char in clean_text_simplified:
                                                if char not in CHARACTER_INDEX:
                                                    CHARACTER_INDEX[char] = []
                                                if poem_index not in CHARACTER_INDEX[char]:
                                                    CHARACTER_INDEX[char].append(poem_index)
        except Exception as e:
            print(f"加载诗词文件失败 {json_file}: {e}")
    
    print(f"诗词数据库加载完成: {len(POETRY_DATABASE)} 句诗（半句）, {len(CHARACTER_INDEX)} 个字符")

def create_room_id():
    """生成随机房间ID"""
    return secrets.token_urlsafe(8)

def create_room():
    """创建新房间"""
    room_id = create_room_id()
    ROOMS[room_id] = {
        'data': {'poems': [], 'grid': [[None for _ in range(100)] for _ in range(100)]},
        'last_active': datetime.now(),
        'created_at': datetime.now()
    }
    print(f"创建房间: {room_id}")
    return room_id

def get_room_data(room_id):
    """获取房间数据"""
    if room_id not in ROOMS:
        return None
    # 更新活动时间
    ROOMS[room_id]['last_active'] = datetime.now()
    return ROOMS[room_id]['data']

def update_room_data(room_id, data):
    """更新房间数据"""
    if room_id in ROOMS:
        ROOMS[room_id]['data'] = data
        ROOMS[room_id]['last_active'] = datetime.now()

def cleanup_inactive_rooms():
    """清理不活跃的房间"""
    while True:
        time.sleep(300)  # 每5分钟检查一次
        now = datetime.now()
        rooms_to_delete = []
        
        for room_id, room_info in ROOMS.items():
            inactive_seconds = (now - room_info['last_active']).total_seconds()
            if inactive_seconds > ROOM_TIMEOUT:
                rooms_to_delete.append(room_id)
        
        for room_id in rooms_to_delete:
            print(f"🗑️ 清理房间: {room_id} (最后活动: {ROOMS[room_id]['last_active'].strftime('%H:%M:%S')})")
            del ROOMS[room_id]
        
        if rooms_to_delete:
            print(f"📊 当前房间数: {len(ROOMS)}")

# 启动房间清理线程
cleanup_thread = threading.Thread(target=cleanup_inactive_rooms, daemon=True)
cleanup_thread.start()

def load_game_data():
    """加载游戏数据"""
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {
        'poems': [],
        'grid': [[None for _ in range(100)] for _ in range(100)],
        'last_updated': datetime.now().isoformat()
    }

def save_game_data(data):
    """保存游戏数据"""
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

@app.route('/')
def index():
    """主页面 - 自动创建或获取房间"""
    # 检查session中是否有房间ID
    if 'room_id' not in session or session['room_id'] not in ROOMS:
        # 创建新房间
        room_id = create_room()
        session['room_id'] = room_id
        print(f"🎮 新用户进入，房间ID: {room_id}")
    else:
        print(f"🔄 用户返回，房间ID: {session['room_id']}")
    
    return render_template('index.html')

@app.route('/api/poems', methods=['GET'])
def get_poems():
    """获取所有诗句"""
    room_id = session.get('room_id')
    if not room_id:
        return jsonify({'success': False, 'error': '未找到房间'}), 400
    
    data = get_room_data(room_id)
    if not data:
        return jsonify({'success': False, 'error': '房间不存在'}), 404
    
    return jsonify(data['poems'])

@app.route('/api/poems', methods=['POST'])
def add_poem():
    """添加新诗句"""
    room_id = session.get('room_id')
    if not room_id:
        return jsonify({'success': False, 'error': '未找到房间'}), 400
    
    data = get_room_data(room_id)
    if not data:
        return jsonify({'success': False, 'error': '房间不存在'}), 404
    
    poem_data = request.json
    
    # 使用前端传来的ID，如果没有则生成新ID
    poem_id = poem_data.get('id') or f"poem_{len(data['poems']) + 1:03d}_{int(datetime.now().timestamp() * 1000)}"
    
    # 创建新诗句对象
    new_poem = {
        'id': poem_id,
        'text': poem_data['text'],
        'direction': poem_data['direction'],
        'startPosition': poem_data['startPosition'],
        'color': poem_data['color'],
        'connectedTo': poem_data.get('connectedTo', []),
        'isAI': poem_data.get('isAI', False),  # 保存AI标记
        'metadata': poem_data.get('metadata'),  # 保存元数据
        'created_at': datetime.now().isoformat()
    }
    
    # 添加到诗句列表
    data['poems'].append(new_poem)
    
    # 更新网格
    update_grid(data, new_poem)
    
    # 更新房间数据
    update_room_data(room_id, data)
    
    print(f"✅ 房间 {room_id}: 诗句已保存 ID={poem_id}, 文本={poem_data['text']}")
    
    return jsonify({'success': True, 'poem': new_poem})

@app.route('/api/grid', methods=['GET'])
def get_grid():
    """获取网格状态"""
    room_id = session.get('room_id')
    if not room_id:
        return jsonify({'success': False, 'error': '未找到房间'}), 400
    
    data = get_room_data(room_id)
    if not data:
        return jsonify({'success': False, 'error': '房间不存在'}), 404
    
    return jsonify(data['grid'])

@app.route('/api/reset', methods=['POST'])
def reset_game():
    """重置游戏"""
    room_id = session.get('room_id')
    if not room_id:
        return jsonify({'success': False, 'error': '未找到房间'}), 400
    
    data = {
        'poems': [],
        'grid': [[None for _ in range(100)] for _ in range(100)]
    }
    update_room_data(room_id, data)
    print(f"🔄 房间 {room_id}: 游戏已重置")
    return jsonify({'success': True})

@app.route('/api/room/info', methods=['GET'])
def get_room_info():
    """获取当前房间信息"""
    room_id = session.get('room_id')
    if not room_id or room_id not in ROOMS:
        return jsonify({'success': False, 'error': '未找到房间'}), 400
    
    room_info = ROOMS[room_id]
    return jsonify({
        'success': True,
        'room_id': room_id,
        'created_at': room_info['created_at'].isoformat(),
        'last_active': room_info['last_active'].isoformat(),
        'poem_count': len(room_info['data']['poems'])
    })

@app.route('/api/ai/find-poem', methods=['POST'])
def ai_find_poem():
    """AI查找诗句"""
    try:
        request_data = request.json
        char = request_data.get('char')
        
        if not char:
            return jsonify({'success': False, 'error': '未提供字符'})
        
        poems = find_poems_by_character(char, max_results=20)
        return jsonify({
            'success': True,
            'poems': poems,
            'count': len(poems)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/ai/place-poem', methods=['POST'])
def ai_place_poem():
    """AI放置诗句"""
    try:
        room_id = session.get('room_id')
        if not room_id:
            return jsonify({'success': False, 'error': '未找到房间'}), 400
        
        data = get_room_data(room_id)
        if not data:
            return jsonify({'success': False, 'error': '房间不存在'}), 404
        
        request_data = request.json
        player_poem_id = request_data.get('playerPoemId')
        ai_color = request_data.get('aiColor', '#FFB6C1')
        
        print(f"\n=== 房间 {room_id}: AI接诗请求 ===")
        print(f"玩家诗句ID: {player_poem_id}")
        
        # 找到玩家刚放置的诗句
        player_poem = None
        for poem in data['poems']:
            if poem['id'] == player_poem_id:
                player_poem = poem
                break
        
        if not player_poem:
            return jsonify({'success': False, 'error': f'未找到玩家诗句 (ID: {player_poem_id})'})
        
        # 尝试为AI找到合适的诗句和位置
        result = find_ai_poem_placement(data, player_poem, ai_color)
        
        if result['success']:
            # 添加AI诗句到游戏数据
            ai_poem = result['poem']
            data['poems'].append(ai_poem)
            update_grid(data, ai_poem)
            update_room_data(room_id, data)
            
            return jsonify({
                'success': True,
                'poem': ai_poem
            })
        else:
            return jsonify(result)
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

def find_ai_poem_placement(data, player_poem, ai_color):
    """为AI找到合适的诗句和位置"""
    # 获取玩家诗句的所有字符位置
    player_text = player_poem['text']
    player_direction = player_poem['direction']
    player_start = player_poem['startPosition']
    
    # 生成所有可能的连接点
    connection_points = []
    for i, char in enumerate(player_text):
        if player_direction == 'horizontal':
            x = player_start['x'] + i
            y = player_start['y']
        else:
            x = player_start['x']
            y = player_start['y'] + i
        connection_points.append({'x': x, 'y': y, 'char': char, 'index': i})
    
    # 按优先级排序连接点：中间 > 后面 > 前面
    text_len = len(player_text)
    def get_priority(point):
        idx = point['index']
        # 中间位置优先级最高
        if text_len > 2 and 0 < idx < text_len - 1:
            return 0  # 最高优先级
        # 后面位置次之
        elif idx == text_len - 1:
            return 1
        # 前面位置最后
        else:
            return 2
    
    connection_points.sort(key=get_priority)
    
    # AI的方向应该与玩家相反
    ai_direction = 'vertical' if player_direction == 'horizontal' else 'horizontal'
    
    print(f"AI尝试接诗，玩家诗句: {player_text}, 方向: {player_direction}")
    print(f"连接点优先级顺序: {[(p['char'], p['index']) for p in connection_points]}")
    
    # 尝试每个字符，最多尝试3次随机诗句
    for point in connection_points:
        poems = find_poems_by_character(point['char'], max_results=20)
        if not poems:
            continue
        
        # 随机打乱诗句顺序
        random.shuffle(poems)
        
        # 尝试最多3首诗
        print(f"尝试字符 '{point['char']}' (索引{point['index']}), 找到 {len(poems)} 首诗")
        for idx, poem in enumerate(poems[:3]):
            print(f"  尝试第{idx+1}首: {poem['text'][:10]}...")
            # 对于每首诗，尝试所有可能的连接位置
            for char_pos in poem['char_positions']:
                # 计算AI诗句的起始位置
                if ai_direction == 'horizontal':
                    start_x = point['x'] - char_pos
                    start_y = point['y']
                else:
                    start_x = point['x']
                    start_y = point['y'] - char_pos
                
                # 检查是否可以放置（不超出边界，不重叠）
                if can_place_poem(data, poem['text'], ai_direction, start_x, start_y, point):
                    # 生成AI诗句对象
                    ai_poem = {
                        'id': f"ai_poem_{len(data['poems']) + 1:03d}_{int(datetime.now().timestamp() * 1000)}",
                        'text': poem['text'],
                        'direction': ai_direction,
                        'startPosition': {'x': start_x, 'y': start_y},
                        'color': ai_color,
                        'connectedTo': [player_poem['id']],
                        'isAI': True,
                        'metadata': {
                            'original': to_simplified(poem.get('half_sentence', poem['text'])),  # AI接的半句（简体）
                            'full_sentence': to_simplified(poem['original']),  # 完整句子（简体）
                            'full_work': poem.get('full_work', to_simplified(poem['original'])),  # 完整作品（简体）
                            'title': poem['title'],  # 已经是简体
                            'author': poem['author'],  # 已经是简体
                            'dynasty': poem['dynasty'],  # 已经是简体
                            'rhythmic': poem.get('rhythmic', '')  # 已经是简体
                        },
                        'created_at': datetime.now().isoformat()
                    }
                    # 简化调试信息
                    print(f"✓ AI接诗: {poem['text']} (位置: {start_x}, {start_y})")
                    return {'success': True, 'poem': ai_poem}
    
    return {'success': False, 'error': '无法找到合适的位置放置AI诗句'}

def can_place_poem(data, text, direction, start_x, start_y, allowed_overlap_point):
    """检查是否可以放置诗句"""
    # 检查边界
    if direction == 'horizontal':
        if start_x < 0 or start_x + len(text) > 100 or start_y < 0 or start_y >= 100:
            return False
    else:
        if start_x < 0 or start_x >= 100 or start_y < 0 or start_y + len(text) > 100:
            return False
    
    # 检查重叠
    for i, char in enumerate(text):
        if direction == 'horizontal':
            check_x = start_x + i
            check_y = start_y
        else:
            check_x = start_x
            check_y = start_y + i
        
        # 如果是允许重叠的连接点，跳过
        if check_x == allowed_overlap_point['x'] and check_y == allowed_overlap_point['y']:
            continue
        
        # 检查该位置是否已被占用
        if data['grid'][check_y][check_x] is not None:
            return False
    
    return True

def find_poems_by_character(char, max_results=10):
    """根据字符查找诗句"""
    load_poetry_database()
    
    if char not in CHARACTER_INDEX:
        return []
    
    poem_indices = CHARACTER_INDEX[char]
    # 随机选择最多max_results个诗句
    selected_indices = random.sample(poem_indices, min(len(poem_indices), max_results))
    
    results = []
    for idx in selected_indices:
        poem = POETRY_DATABASE[idx]
        # 找到字符在诗句中的所有位置
        positions = [i for i, c in enumerate(poem['text']) if c == char]
        results.append({
            'text': poem['text'],
            'original': poem['original'],
            'title': poem['title'],
            'author': poem['author'],
            'dynasty': poem['dynasty'],
            'char_positions': positions
        })
    
    return results

def update_grid(data, poem):
    """更新网格数据"""
    x, y = poem['startPosition']['x'], poem['startPosition']['y']
    text = poem['text']
    
    if poem['direction'] == 'horizontal':
        # 横向排列
        for i, char in enumerate(text):
            if 0 <= x + i < 100 and 0 <= y < 100:
                data['grid'][y][x + i] = {
                    'char': char,
                    'poem_id': poem['id'],
                    'color': poem['color'],
                    'isAI': poem.get('isAI', False),
                    'metadata': poem.get('metadata')
                }
    else:
        # 纵向排列
        for i, char in enumerate(text):
            if 0 <= x < 100 and 0 <= y + i < 100:
                data['grid'][y + i][x] = {
                    'char': char,
                    'poem_id': poem['id'],
                    'color': poem['color'],
                    'isAI': poem.get('isAI', False),
                    'metadata': poem.get('metadata')
                }

if __name__ == '__main__':
    # 启动时加载诗词数据库
    print("正在加载诗词数据库...")
    load_poetry_database()
    print("诗词数据库加载完成！")
    
    app.run(debug=True, host='0.0.0.0', port=7000)

