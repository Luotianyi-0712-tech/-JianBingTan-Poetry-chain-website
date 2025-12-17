// 游戏状态管理
class GameState {
    constructor() {
        this.poems = [];
        this.grid = Array(100).fill(null).map(() => Array(100).fill(null));
        this.selectedCell = null;
        this.currentDirection = 'horizontal';
        this.zoomLevel = 1;
        this.isFirstPoem = true;
        this.canvas = null;
        this.ctx = null;
        this.offsetX = 0;
        this.offsetY = 0;
        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this.selectedColor = '#9370DB';
        this.aiColor = '#FFB6C1';
        this.aiEnabled = true;
        this.aiCallback = null; // AI回调函数
    }

    // 初始化Canvas
    initCanvas() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();
        this.bindCanvasEvents();
        this.renderCanvas();
    }

    // 调整Canvas大小
    resizeCanvas() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
    }

    // 绑定Canvas事件
    bindCanvasEvents() {
        // 鼠标滚轮缩放
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            this.zoomAt(e.offsetX, e.offsetY, delta);
        });

        // 鼠标拖拽
        this.canvas.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
            this.canvas.style.cursor = 'grabbing';
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                const deltaX = e.clientX - this.lastMouseX;
                const deltaY = e.clientY - this.lastMouseY;
                this.offsetX += deltaX;
                this.offsetY += deltaY;
                this.lastMouseX = e.clientX;
                this.lastMouseY = e.clientY;
                this.renderCanvas();
            }
        });

        this.canvas.addEventListener('mouseup', () => {
            this.isDragging = false;
            this.canvas.style.cursor = 'grab';
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.isDragging = false;
            this.canvas.style.cursor = 'grab';
        });

        // 左键点击事件
        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = Math.floor((e.clientX - rect.left - this.offsetX) / (40 * this.zoomLevel));
            const y = Math.floor((e.clientY - rect.top - this.offsetY) / (40 * this.zoomLevel));
            
            if (x >= 0 && x < 100 && y >= 0 && y < 100) {
                const cellData = this.grid[y][x];
                // 单击事件：处理接龙
                this.handleCellClick(x, y, cellData);
            }
        });

        // 右键点击事件（查看AI诗句详情）
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault(); // 阻止浏览器默认右键菜单
            
            const rect = this.canvas.getBoundingClientRect();
            const x = Math.floor((e.clientX - rect.left - this.offsetX) / (40 * this.zoomLevel));
            const y = Math.floor((e.clientY - rect.top - this.offsetY) / (40 * this.zoomLevel));
            
            if (x >= 0 && x < 100 && y >= 0 && y < 100) {
                const cellData = this.grid[y][x];
                // 右键事件：查看AI诗句详情
                this.handleRightClick(x, y, cellData);
            }
        });

        // 窗口大小改变
        window.addEventListener('resize', () => {
            this.resizeCanvas();
            this.renderCanvas();
        });
    }

    // 在指定位置缩放
    zoomAt(x, y, factor) {
        const newZoom = Math.max(0.1, Math.min(5, this.zoomLevel * factor));
        if (newZoom !== this.zoomLevel) {
            this.zoomLevel = newZoom;
            this.updateZoomDisplay();
            this.renderCanvas();
        }
    }

    // 更新缩放显示
    updateZoomDisplay() {
        const zoomDisplay = document.getElementById('zoomLevelDisplay');
        if (zoomDisplay) {
            zoomDisplay.textContent = Math.round(this.zoomLevel * 100) + '%';
        }
    }

    // 添加诗句
    addPoem(poem) {
        // 为诗句生成唯一ID
        if (!poem.id) {
            poem.id = 'poem_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        }
        
        this.poems.push(poem);
        this.updateGrid(poem);
        this.updateUI();
        
        // 添加调试信息
        console.log('诗句添加成功:', {
            'ID': poem.id,
            '文本': poem.text,
            '方向': poem.direction,
            '位置': poem.startPosition,
            '当前方向': this.currentDirection
        });
    }

    // 更新网格
    updateGrid(poem) {
        const { x, y } = poem.startPosition;
        const text = poem.text;
        
        console.log('更新网格:', {
            '诗句ID': poem.id,
            '诗句文本': poem.text,
            '诗句方向': poem.direction,
            '起始位置': { x, y },
            '长度': text.length,
            '是否AI': poem.isAI
        });
        
        if (poem.direction === 'horizontal') {
            for (let i = 0; i < text.length; i++) {
                if (x + i < 100 && y < 100) {
                    this.grid[y][x + i] = {
                        char: text[i],
                        poemId: poem.id,
                        color: poem.color,
                        isAI: poem.isAI || false,
                        metadata: poem.metadata
                    };
                    console.log(`横向填充网格 [${y}][${x + i}]:`, this.grid[y][x + i]);
                }
            }
        } else {
            for (let i = 0; i < text.length; i++) {
                if (x < 100 && y + i < 100) {
                    this.grid[y + i][x] = {
                        char: text[i],
                        poemId: poem.id,
                        color: poem.color,
                        isAI: poem.isAI || false,
                        metadata: poem.metadata
                    };
                    console.log(`纵向填充网格 [${y + i}][${x}]:`, this.grid[y + i][x]);
                }
            }
        }
    }

    // 更新UI
    updateUI() {
        this.renderCanvas();
        this.updatePoemCount();
        this.updateDirectionDisplay();
    }

    // 渲染Canvas
    renderCanvas() {
        if (!this.ctx) return;

        // 清空画布
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 设置背景
        this.ctx.fillStyle = '#fafafa';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // 绘制网格
        this.drawGrid();

        // 绘制诗句
        this.drawPoems();

        // 绘制选中状态
        if (this.selectedCell) {
            this.drawSelection();
        }
    }

    // 绘制网格
    drawGrid() {
        this.ctx.strokeStyle = '#e8e8d0';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([]);

        const cellSize = 40 * this.zoomLevel;
        const startX = this.offsetX;
        const startY = this.offsetY;

        // 绘制垂直线
        for (let x = 0; x <= 100; x++) {
            const screenX = startX + x * cellSize;
            if (screenX >= -cellSize && screenX <= this.canvas.width + cellSize) {
                this.ctx.beginPath();
                this.ctx.moveTo(screenX, startY);
                this.ctx.lineTo(screenX, startY + 100 * cellSize);
                this.ctx.stroke();
            }
        }

        // 绘制水平线
        for (let y = 0; y <= 100; y++) {
            const screenY = startY + y * cellSize;
            if (screenY >= -cellSize && screenY <= this.canvas.height + cellSize) {
                this.ctx.beginPath();
                this.ctx.moveTo(startX, screenY);
                this.ctx.lineTo(startX + 100 * cellSize, screenY);
                this.ctx.stroke();
            }
        }
    }

    // 绘制诗句
    drawPoems() {
        const cellSize = 40 * this.zoomLevel;
        const startX = this.offsetX;
        const startY = this.offsetY;

        // 第一遍：绘制背景和文字
        for (let y = 0; y < 100; y++) {
            for (let x = 0; x < 100; x++) {
                const cellData = this.grid[y][x];
                if (cellData) {
                    const screenX = startX + x * cellSize;
                    const screenY = startY + y * cellSize;

                    // 绘制背景色
                    this.ctx.fillStyle = cellData.color;
                    this.ctx.fillRect(screenX, screenY, cellSize, cellSize);

                    // 绘制文字
                    this.ctx.fillStyle = 'white';
                    this.ctx.font = `${Math.max(12, Math.floor(16 * this.zoomLevel))}px Microsoft YaHei`;
                    this.ctx.textAlign = 'center';
                    this.ctx.textBaseline = 'middle';
                    this.ctx.fillText(
                        cellData.char,
                        screenX + cellSize / 2,
                        screenY + cellSize / 2
                    );
                }
            }
        }

        // 第二遍：为AI诗句绘制整体边框
        this.poems.forEach(poem => {
            if (poem.isAI) {
                this.drawAIPoemBorder(poem);
            }
        });
    }

    // 为AI诗句绘制边框
    drawAIPoemBorder(poem) {
        const cellSize = 40 * this.zoomLevel;
        const startX = this.offsetX;
        const startY = this.offsetY;
        const { x, y } = poem.startPosition;
        const length = poem.text.length;

        // 计算边框位置
        let borderX, borderY, borderWidth, borderHeight;
        
        if (poem.direction === 'horizontal') {
            borderX = startX + x * cellSize;
            borderY = startY + y * cellSize;
            borderWidth = length * cellSize;
            borderHeight = cellSize;
        } else {
            borderX = startX + x * cellSize;
            borderY = startY + y * cellSize;
            borderWidth = cellSize;
            borderHeight = length * cellSize;
        }

        // 绘制边框（淡红色，1像素）
        this.ctx.strokeStyle = 'rgba(255, 100, 120, 0.9)';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(borderX, borderY, borderWidth, borderHeight);
    }

    // 绘制选中状态
    drawSelection() {
        if (!this.selectedCell) return;

        const { x, y } = this.selectedCell;
        const cellSize = 40 * this.zoomLevel;
        const startX = this.offsetX;
        const startY = this.offsetY;

        const screenX = startX + x * cellSize;
        const screenY = startY + y * cellSize;

        this.ctx.strokeStyle = '#8b7355';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([]);
        this.ctx.strokeRect(screenX, screenY, cellSize, cellSize);
    }

    // 处理单元格点击
    handleCellClick(x, y, cellData) {
        if (!cellData) {
            // 空单元格，可以开始新诗句
            if (this.isFirstPoem) {
                this.startNewPoem();
            }
            return;
        }

        // 已填充的单元格，可以接龙
        this.startChainPoem(x, y, cellData);
    }

    // 开始新诗句
    startNewPoem() {
        const input = document.getElementById('poemInput');
        input.focus();
        this.showToast('请输入第一句诗', 'info');
    }

    // 开始接龙诗句
    startChainPoem(x, y, cellData) {
        this.selectedCell = { x, y, data: cellData };
        
        // 找到对应的诗句
        const poem = this.poems.find(p => p.id === cellData.poemId);
        if (!poem) return;

        // 确定新诗句的方向（横纵转换）
        // 如果前句是横向，新句必须是纵向；如果前句是纵向，新句必须是横向
        const newDirection = poem.direction === 'horizontal' ? 'vertical' : 'horizontal';
        
        // 添加调试信息
        console.log('接龙方向转换:', {
            '前句ID': poem.id,
            '前句方向': poem.direction,
            '前句文本': poem.text,
            '新句方向': newDirection,
            '连接字符': cellData.char,
            '连接字符位置': { x, y },
            '网格数据': cellData
        });
        
        // 显示接龙模态框
        this.showChainModal(poem.direction, newDirection, cellData.char);
    }

    // 显示接龙模态框
    showChainModal(prevDirection, newDirection, connectChar) {
        // 创建模态框
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>接龙诗句输入</h3>
                    <span class="close">&times;</span>
                </div>
                <div class="modal-body">
                    <p>检测到前句方向: <span id="prevDirection">${prevDirection === 'horizontal' ? '横向' : '纵向'}</span></p>
                    <p>当前句方向: <span id="newDirection">${newDirection === 'horizontal' ? '横向' : '纵向'}</span></p>
                    <p>连接字符: <span id="connectChar">${connectChar}</span></p>
                    <p class="direction-hint">💡 <strong>方向转换规则：</strong>前句是${prevDirection === 'horizontal' ? '横向' : '纵向'}，新句必须是${newDirection === 'horizontal' ? '横向' : '纵向'}</p>
                    <div class="input-group">
                        <input type="text" id="chainInput" placeholder="请输入接龙诗句" maxlength="30">
                        <button id="confirmChainBtn" class="btn btn-primary">确认接龙</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        modal.style.display = 'block';

        // 绑定事件
        const closeBtn = modal.querySelector('.close');
        const confirmBtn = modal.querySelector('#confirmChainBtn');
        const input = modal.querySelector('#chainInput');

        closeBtn.addEventListener('click', () => this.hideChainModal(modal));
        confirmBtn.addEventListener('click', () => this.handleChainPoem(input.value, modal));
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleChainPoem(input.value, modal);
            }
        });

        // 点击外部关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.hideChainModal(modal);
            }
        });

        // 聚焦到输入框
        input.focus();
        
        // 设置新诗句的方向（强制横纵转换）
        this.currentDirection = newDirection;
        
        // 添加调试信息
        console.log('模态框设置方向:', {
            '前句方向': prevDirection,
            '新句方向': newDirection,
            '当前方向': this.currentDirection
        });
    }

    // 隐藏接龙模态框
    hideChainModal(modal) {
        if (modal && modal.parentNode) {
            modal.parentNode.removeChild(modal);
        }
        this.selectedCell = null;
    }

    // 处理接龙诗句
    async handleChainPoem(text, modal) {
        if (!text.trim()) {
            this.showToast('请输入接龙诗句', 'error');
            return;
        }

        if (text.length > 30) {
            this.showToast('诗句长度不能超过30字', 'error');
            return;
        }

        if (!this.selectedCell) {
            this.showToast('请先选择连接位置', 'error');
            return;
        }

        try {
            const color = this.getSelectedColor();
            const direction = this.currentDirection;
            const { x: selectedX, y: selectedY, data } = this.selectedCell;
            
            // 找到连接的诗句
            const connectedPoem = this.poems.find(p => p.id === data.poemId);
            
            // 添加调试信息
            console.log('接龙处理:', {
                '当前方向': direction,
                '连接诗句ID': connectedPoem.id,
                '连接诗句方向': connectedPoem.direction,
                '连接诗句文本': connectedPoem.text,
                '新诗句文本': text,
                '连接字符': data.char,
                '选中位置': { x: selectedX, y: selectedY },
                '网格数据': data
            });
            
            // 验证方向转换规则
            if (connectedPoem.direction === direction) {
                this.showToast('接龙诗句方向必须与连接诗句方向不同（横纵转换）', 'error');
                console.error('方向转换验证失败:', {
                    '连接诗句方向': connectedPoem.direction,
                    '新诗句方向': direction
                });
                return;
            }
            
            // 双重验证：确保方向确实是横纵转换
            const expectedDirection = connectedPoem.direction === 'horizontal' ? 'vertical' : 'horizontal';
            if (direction !== expectedDirection) {
                this.showToast(`接龙诗句方向错误，应该是${expectedDirection === 'horizontal' ? '横向' : '纵向'}`, 'error');
                console.error('方向转换验证失败:', {
                    '连接诗句方向': connectedPoem.direction,
                    '期望方向': expectedDirection,
                    '实际方向': direction
                });
                return;
            }
            
            // 找到连接字符在新诗句中的位置
            const connectChar = data.char;
            const connectIndex = text.indexOf(connectChar);
            
            if (connectIndex === -1) {
                this.showToast('新诗句必须包含连接字符', 'error');
                return;
            }
            
            // 计算新诗句的起始位置，使连接字符位于选中的位置
            let startPosition;
            if (direction === 'horizontal') {
                startPosition = { x: selectedX - connectIndex, y: selectedY };
            } else {
                startPosition = { x: selectedX, y: selectedY - connectIndex };
            }
            
            // 检查边界
            if (startPosition.x < 0 || startPosition.y < 0 || 
                (direction === 'horizontal' && startPosition.x + text.length > 100) ||
                (direction === 'vertical' && startPosition.y + text.length > 100)) {
                this.showToast('诗句超出边界，请选择其他位置', 'error');
                return;
            }
            
            // 检查是否与已有诗句重叠
            console.log('开始检查重叠...');
            // 传入允许重叠的连接字符位置
            const allowedOverlapPosition = { x: selectedX, y: selectedY };
            if (this.wouldOverlapExistingPoem(text, direction, startPosition, allowedOverlapPosition)) {
                console.log('重叠检测失败，阻止添加');
                this.showToast('新诗句与已有诗句重叠，请选择其他位置', 'error');
                return;
            }
            console.log('重叠检测通过，可以添加');
            
            const poemData = {
                id: 'poem_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                text: text,
                direction: direction,
                startPosition: startPosition,
                color: color,
                connectedTo: [connectedPoem.id]
            };

            // 先保存到后端
            await ApiService.addPoem(poemData);
            
            // 再添加到本地状态（this 就是 GameState 实例）
            this.addPoem(poemData);
            
            // 隐藏模态框
            this.hideChainModal(modal);
            
            // 调试：显示当前系统状态
            this.debugPoems();
            
            this.showToast('接龙成功', 'success');
            
            // 如果启用AI，让AI接诗
            if (this.aiEnabled && this.aiCallback) {
                setTimeout(() => {
                    this.aiCallback(poemData.id);
                }, 500);
            }
        } catch (error) {
            console.error('接龙失败:', error);
            this.showToast('接龙失败: ' + (error.message || '未知错误'), 'error');
        }
    }

    // 获取选中的颜色
    getSelectedColor() {
        return this.selectedColor;
    }

    // 设置选中的颜色
    setSelectedColor(color) {
        this.selectedColor = color;
        
        // 移除之前的选中状态（只针对玩家颜色）
        document.querySelectorAll('.color-option:not(.ai-color)').forEach(option => {
            option.classList.remove('selected');
        });
        
        // 设置新的选中状态
        const colorOption = document.querySelector(`.color-option:not(.ai-color)[data-color="${color}"]`);
        if (colorOption) {
            colorOption.classList.add('selected');
        }
        
        // 更新自定义颜色选择器
        const customColorPicker = document.getElementById('customColorPicker');
        if (customColorPicker) {
            customColorPicker.value = color;
        }
    }

    // 设置AI颜色
    setAIColor(color) {
        this.aiColor = color;
        
        // 移除之前的选中状态（只针对AI颜色）
        document.querySelectorAll('.ai-color').forEach(option => {
            option.classList.remove('selected');
        });
        
        // 设置新的选中状态
        const colorOption = document.querySelector(`.ai-color[data-color="${color}"]`);
        if (colorOption) {
            colorOption.classList.add('selected');
        }
        
        // 更新自定义颜色选择器
        const aiCustomColorPicker = document.getElementById('aiCustomColorPicker');
        if (aiCustomColorPicker) {
            aiCustomColorPicker.value = color;
        }
    }

    // 处理右键点击事件（查看AI诗句详情）
    handleRightClick(x, y, cellData) {
        if (!cellData || !cellData.isAI) {
            // 如果不是AI诗句，提示用户
            this.showToast('只有AI诗句（红色边框）才能右键查看详情', 'info');
            return;
        }

        // 找到对应的AI诗句
        const poem = this.poems.find(p => p.id === cellData.poemId);
        if (!poem || !poem.metadata) {
            this.showToast('未找到诗句信息', 'error');
            return;
        }

        // 显示诗词详情
        this.showPoemDetail(poem.metadata);
    }

    // 显示诗词详情
    showPoemDetail(metadata) {
        const modal = document.getElementById('poemDetailModal');
        const titleText = document.getElementById('poemDetailTitleText');
        const rhythmicRow = document.getElementById('poemDetailRhythmicRow');
        const rhythmic = document.getElementById('poemDetailRhythmic');
        const author = document.getElementById('poemDetailAuthor');
        const dynasty = document.getElementById('poemDetailDynasty');
        const original = document.getElementById('poemDetailOriginal');
        const fullSentenceRow = document.getElementById('poemDetailFullSentenceRow');
        const fullSentence = document.getElementById('poemDetailFullSentence');

        // 基本信息
        if (titleText) titleText.textContent = metadata.title || '未知';
        if (author) author.textContent = metadata.author || '未知';
        if (dynasty) dynasty.textContent = metadata.dynasty || '未知';
        if (original) original.textContent = metadata.original || '未知';
        
        // 词牌名（如果有）
        if (metadata.rhythmic && rhythmicRow && rhythmic) {
            rhythmic.textContent = metadata.rhythmic;
            rhythmicRow.style.display = 'block';
        } else if (rhythmicRow) {
            rhythmicRow.style.display = 'none';
        }
        
        // 完整句子
        if (metadata.full_sentence && fullSentenceRow && fullSentence) {
            fullSentence.textContent = metadata.full_sentence;
            fullSentenceRow.style.display = 'block';
        } else if (fullSentenceRow) {
            fullSentenceRow.style.display = 'none';
        }

        if (modal) {
            modal.style.display = 'block';
        }
    }

    // 更新诗句数量
    updatePoemCount() {
        const poemCount = document.getElementById('poemCount');
        const playerPoemCount = document.getElementById('playerPoemCount');
        const aiPoemCount = document.getElementById('aiPoemCount');
        
        if (poemCount) {
            poemCount.textContent = this.poems.length;
        }
        
        if (playerPoemCount) {
            const playerCount = this.poems.filter(p => !p.isAI).length;
            playerPoemCount.textContent = playerCount;
        }
        
        if (aiPoemCount) {
            const aiCount = this.poems.filter(p => p.isAI).length;
            aiPoemCount.textContent = aiCount;
        }
    }

    // 更新方向显示
    updateDirectionDisplay() {
        // 这个功能在新的UI中不需要了
    }
    
    // 调试方法：显示所有诗句信息
    debugPoems() {
        console.log('=== 当前所有诗句信息 ===');
        this.poems.forEach((poem, index) => {
            console.log(`诗句 ${index + 1}:`, {
                'ID': poem.id,
                '文本': poem.text,
                '方向': poem.direction,
                '位置': poem.startPosition,
                '颜色': poem.color,
                '连接关系': poem.connectedTo
            });
        });
        console.log('=== 网格状态 ===');
        // 显示非空网格单元格
        let filledCells = 0;
        for (let y = 0; y < 100; y++) {
            for (let x = 0; x < 100; x++) {
                if (this.grid[y][x]) {
                    filledCells++;
                    if (filledCells <= 20) { // 只显示前20个，避免日志过长
                        console.log(`网格 [${y}][${x}]:`, this.grid[y][x]);
                    }
                }
            }
        }
        console.log(`总共有 ${filledCells} 个填充的网格单元格`);
    }
    
    // 检查新诗句是否会与已有诗句重叠
    wouldOverlapExistingPoem(text, direction, startPosition, allowedOverlapPosition = null) {
        const { x, y } = startPosition;
        const length = text.length;
        
        console.log('检查重叠:', {
            '新诗句文本': text,
            '新诗句方向': direction,
            '起始位置': startPosition,
            '长度': length,
            '允许重叠位置': allowedOverlapPosition
        });
        
        // 检查每个字符位置是否已被占用
        for (let i = 0; i < length; i++) {
            let checkX, checkY;
            
            if (direction === 'horizontal') {
                checkX = x + i;
                checkY = y;
            } else {
                checkX = x;
                checkY = y + i;
            }
            
            // 检查边界
            if (checkX < 0 || checkX >= 100 || checkY < 0 || checkY >= 100) {
                console.log(`位置 [${checkY}][${checkX}] 超出边界`);
                return true; // 超出边界也算重叠
            }
            
            // 检查是否已被占用
            if (this.grid[checkY][checkX]) {
                const existingCell = this.grid[checkY][checkX];
                
                // 如果这个位置是允许重叠的连接字符位置，则跳过检查
                if (allowedOverlapPosition && 
                    checkX === allowedOverlapPosition.x && 
                    checkY === allowedOverlapPosition.y) {
                    console.log(`位置 [${checkY}][${checkX}] 是允许重叠的连接字符位置，跳过检查`);
                    continue;
                }
                
                console.log(`位置 [${checkY}][${checkX}] 已被占用:`, {
                    '字符': existingCell.char,
                    '诗句ID': existingCell.poemId,
                    '颜色': existingCell.color
                });
                return true; // 发现不允许的重叠
            }
        }
        
        console.log('无重叠，可以添加');
        return false; // 无重叠
    }

    // 重置游戏
    reset() {
        this.poems = [];
        this.grid = Array(100).fill(null).map(() => Array(100).fill(null));
        this.selectedCell = null;
        this.currentDirection = 'horizontal';
        this.isFirstPoem = true;
        this.zoomLevel = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.updateUI();
        this.showToast('游戏已重置', 'success');
    }

    // 清除选择
    clearSelection() {
        this.selectedCell = null;
        this.renderCanvas();
        this.showToast('选择已清除', 'info');
    }

    // 缩放控制
    zoomIn() {
        this.zoomAt(this.canvas.width / 2, this.canvas.height / 2, 1.2);
    }

    zoomOut() {
        this.zoomAt(this.canvas.width / 2, this.canvas.height / 2, 0.8);
    }

    resetZoom() {
        this.zoomLevel = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.updateZoomDisplay();
        this.renderCanvas();
    }

    // 显示提示信息
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        const container = document.getElementById('toastContainer') || document.body;
        container.appendChild(toast);
        
        // 显示动画
        setTimeout(() => toast.classList.add('show'), 10);
        
        // 自动隐藏
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }

    // 更新AI状态面板
    updateAIStatus(status, detail = '') {
        const content = document.getElementById('aiStatusContent');
        if (!content) return;

        let html = '';
        switch (status) {
            case 'idle':
                html = '<span class="ai-status-idle">待机中</span>';
                break;
            case 'thinking':
                html = '<span class="ai-status-thinking">正在思考...</span>';
                if (detail) {
                    html += `<div class="ai-status-detail">分析字符: ${detail}</div>`;
                }
                break;
            case 'success':
                html = '<span class="ai-status-success">接诗成功！</span>';
                if (detail) {
                    html += `<div class="ai-status-poem">${detail}</div>`;
                }
                break;
            case 'error':
                html = '<span class="ai-status-error">接诗失败</span>';
                if (detail) {
                    html += `<div class="ai-status-detail">${detail}</div>`;
                }
                break;
        }
        content.innerHTML = html;

        // 成功或错误后3秒恢复待机状态
        if (status === 'success' || status === 'error') {
            setTimeout(() => {
                this.updateAIStatus('idle');
            }, 3000);
        }
    }
}

// API 服务
class ApiService {
    static async getPoems() {
        try {
            const response = await fetch('/api/poems');
            return await response.json();
        } catch (error) {
            console.error('获取诗句失败:', error);
            return [];
        }
    }

    static async addPoem(poemData) {
        try {
            const response = await fetch('/api/poems', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(poemData)
            });
            return await response.json();
        } catch (error) {
            console.error('添加诗句失败:', error);
            throw error;
        }
    }

    static async resetGame() {
        try {
            const response = await fetch('/api/reset', {
                method: 'POST'
            });
            return await response.json();
        } catch (error) {
            console.error('重置游戏失败:', error);
            throw error;
        }
    }

    static async requestAIPoem(playerPoemId, aiColor) {
        try {
            const response = await fetch('/api/ai/place-poem', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    playerPoemId: playerPoemId,
                    aiColor: aiColor
                })
            });
            return await response.json();
        } catch (error) {
            console.error('AI接诗失败:', error);
            throw error;
        }
    }
}

// 游戏主类
class JianbingGame {
    constructor() {
        this.gameState = new GameState();
        this.init();
    }

    async init() {
        await this.loadRoomInfo();
        await this.loadGameData();
        this.bindEvents();
        this.gameState.initCanvas();
        this.gameState.updateUI();
        // 初始化默认选中的颜色
        this.gameState.setSelectedColor('#9370DB');
        this.gameState.setAIColor('#FFB6C1');
        // 设置AI回调
        this.gameState.aiCallback = (poemId) => this.requestAIPoem(poemId);
    }

    async loadRoomInfo() {
        try {
            const response = await fetch('/api/room/info');
            const data = await response.json();
            if (data.success) {
                const roomIdElement = document.getElementById('roomId');
                if (roomIdElement) {
                    roomIdElement.textContent = data.room_id;
                    roomIdElement.title = `创建时间: ${new Date(data.created_at).toLocaleString()}`;
                }
                console.log('🏠 房间ID:', data.room_id);
            }
        } catch (error) {
            console.error('获取房间信息失败:', error);
        }
    }

    async loadGameData() {
        try {
            const poems = await ApiService.getPoems();
            this.gameState.poems = poems;
            
            // 重建网格
            this.gameState.grid = Array(100).fill(null).map(() => Array(100).fill(null));
            poems.forEach(poem => this.gameState.updateGrid(poem));
            
            this.gameState.isFirstPoem = poems.length === 0;
        } catch (error) {
            console.error('加载游戏数据失败:', error);
        }
    }

    bindEvents() {
        // 输入新诗句按钮
        const addPoemBtn = document.getElementById('addPoemBtn');
        if (addPoemBtn) {
            addPoemBtn.addEventListener('click', () => {
                this.handleAddPoem();
            });
        }

        // 重置游戏按钮
        const resetBtn = document.getElementById('resetBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.handleResetGame();
            });
        }

        // 导出画布按钮
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.handleExportCanvas();
            });
        }

        // 导入画布按钮
        const importBtn = document.getElementById('importBtn');
        const importFileInput = document.getElementById('importFileInput');
        if (importBtn && importFileInput) {
            importBtn.addEventListener('click', () => {
                importFileInput.click();
            });
            
            importFileInput.addEventListener('change', (e) => {
                this.handleImportCanvas(e);
            });
        }

        // 颜色选择器
        const colorOptions = document.querySelectorAll('.color-option');
        colorOptions.forEach(option => {
            option.addEventListener('click', () => {
                const color = option.dataset.color;
                if (color) {
                    this.gameState.setSelectedColor(color);
                }
            });
        });

        // 自定义颜色选择器
        const customColorPicker = document.getElementById('customColorPicker');
        if (customColorPicker) {
            customColorPicker.addEventListener('change', (e) => {
                this.gameState.setSelectedColor(e.target.value);
            });
        }

        // AI颜色选择器
        const aiColorOptions = document.querySelectorAll('.ai-color');
        aiColorOptions.forEach(option => {
            option.addEventListener('click', () => {
                const color = option.dataset.color;
                if (color) {
                    this.gameState.setAIColor(color);
                }
            });
        });

        // AI自定义颜色选择器
        const aiCustomColorPicker = document.getElementById('aiCustomColorPicker');
        if (aiCustomColorPicker) {
            aiCustomColorPicker.addEventListener('change', (e) => {
                this.gameState.setAIColor(e.target.value);
            });
        }

        // AI开关
        const aiToggle = document.getElementById('aiToggle');
        if (aiToggle) {
            aiToggle.addEventListener('change', (e) => {
                this.gameState.aiEnabled = e.target.checked;
                console.log('AI开关:', this.gameState.aiEnabled);
            });
        }

        // 诗句输入框
        const poemInput = document.getElementById('poemInput');
        if (poemInput) {
            poemInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleAddPoem();
                }
            });

            poemInput.addEventListener('input', (e) => {
                const charCount = document.getElementById('currentChars');
                if (charCount) {
                    charCount.textContent = e.target.value.length;
                }
            });
        }
    }

    async handleAddPoem() {
        const input = document.getElementById('poemInput');
        if (!input) return;

        const text = input.value.trim();
        
        if (!text) {
            this.gameState.showToast('请输入诗句', 'error');
            return;
        }

        if (text.length > 30) {
            this.gameState.showToast('诗句长度不能超过30字', 'error');
            return;
        }

        try {
            const color = this.gameState.getSelectedColor();
            const direction = this.gameState.currentDirection;
            
            // 确定起始位置 - 修改为(45,45)
            let startPosition;
            if (this.gameState.isFirstPoem) {
                // 第一句诗放在(45,45)位置
                startPosition = { x: 45, y: 45 };
                
                // 检查第一句诗是否与已有内容重叠（虽然通常不会有）
                console.log('检查第一句诗重叠...');
                if (this.gameState.wouldOverlapExistingPoem(text, direction, startPosition, null)) {
                    console.log('第一句诗重叠检测失败');
                    this.gameState.showToast('起始位置已被占用，请重置游戏', 'error');
                    return;
                }
                console.log('第一句诗重叠检测通过');
            } else {
                // 后续诗句需要选择位置
                this.gameState.showToast('请点击网格中的位置来放置诗句', 'info');
                return;
            }

            const poemData = {
                id: 'poem_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                text: text,
                direction: direction,
                startPosition: startPosition,
                color: color,
                connectedTo: []
            };

            // 先保存到后端
            await ApiService.addPoem(poemData);
            
            // 再添加到本地状态
            this.gameState.addPoem(poemData);
            
            // 清空输入框
            input.value = '';
            
            // 更新字符计数
            const charCount = document.getElementById('currentChars');
            if (charCount) {
                charCount.textContent = '0';
            }
            
            // 第一句诗添加完成后，重置方向为横向，为下次接龙做准备
            this.gameState.currentDirection = 'horizontal';
            this.gameState.isFirstPoem = false;
            
            // 添加调试信息
            console.log('第一句诗添加完成:', {
                '方向': poemData.direction,
                '当前方向': this.gameState.currentDirection,
                '诗句ID': poemData.id
            });
            
            // 调试：显示当前系统状态
            this.gameState.debugPoems();
            
            this.gameState.showToast('诗句添加成功', 'success');
            
            // 如果启用AI且不是第一句诗，让AI接诗
            if (this.gameState.aiEnabled && this.gameState.poems.length > 0) {
                setTimeout(() => {
                    this.requestAIPoem(poemData.id);
                }, 800);
            }
        } catch (error) {
            this.gameState.showToast('添加诗句失败', 'error');
        }
    }

    async handleResetGame() {
        if (confirm('确定要重置游戏吗？所有数据将丢失。')) {
            try {
                await ApiService.resetGame();
                this.gameState.reset();
            } catch (error) {
                this.gameState.showToast('重置失败', 'error');
            }
        }
    }

    // 导出画布
    handleExportCanvas() {
        try {
            // 获取当前房间的所有游戏数据
            const exportData = {
                version: '1.0',
                exportTime: new Date().toISOString(),
                poems: this.gameState.poems,
                grid: this.gameState.grid
            };

            // 转换为JSON字符串
            const jsonStr = JSON.stringify(exportData, null, 2);
            
            // 创建Blob对象
            const blob = new Blob([jsonStr], { type: 'application/json' });
            
            // 创建下载链接
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `诗词接龙_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
            
            // 触发下载
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            // 释放URL对象
            URL.revokeObjectURL(url);
            
            this.gameState.showToast('画布导出成功！', 'success');
        } catch (error) {
            console.error('导出失败:', error);
            this.gameState.showToast('导出失败', 'error');
        }
    }

    // 导入画布
    async handleImportCanvas(event) {
        const file = event.target.files[0];
        if (!file) return;

        // 重置文件输入，允许重复选择同一文件
        event.target.value = '';

        try {
            const reader = new FileReader();
            
            reader.onload = async (e) => {
                try {
                    const importData = JSON.parse(e.target.result);
                    
                    // 验证数据格式
                    if (!importData.poems || !Array.isArray(importData.poems)) {
                        throw new Error('无效的数据格式');
                    }

                    // 确认导入
                    if (!confirm(`确定要导入画布吗？\n\n导入时间：${new Date(importData.exportTime).toLocaleString()}\n诗句数量：${importData.poems.length}\n\n当前画布数据将被覆盖！`)) {
                        return;
                    }

                    // 先重置游戏
                    await ApiService.resetGame();
                    
                    // 导入所有诗句
                    for (const poem of importData.poems) {
                        await ApiService.addPoem(poem);
                    }
                    
                    // 重新加载游戏数据
                    await this.loadGameData();
                    
                    // 重新渲染
                    this.gameState.renderCanvas();
                    this.gameState.updateUI();
                    
                    this.gameState.showToast(`导入成功！已导入 ${importData.poems.length} 句诗`, 'success');
                } catch (error) {
                    console.error('解析导入数据失败:', error);
                    this.gameState.showToast('导入失败：文件格式错误', 'error');
                }
            };
            
            reader.onerror = () => {
                this.gameState.showToast('读取文件失败', 'error');
            };
            
            reader.readAsText(file);
        } catch (error) {
            console.error('导入失败:', error);
            this.gameState.showToast('导入失败', 'error');
        }
    }

    handleSaveGame() {
        // 这里可以实现保存功能，比如导出为图片或保存到本地
        this.gameState.showToast('保存功能开发中...', 'info');
    }
    
    // 测试重叠检测功能
    testOverlapDetection() {
        console.log('=== 测试重叠检测功能 ===');
        
        // 测试用例1：检查空位置
        const emptyPosition = { x: 50, y: 50 };
        const testText1 = '测试诗句';
        const result1 = this.gameState.wouldOverlapExistingPoem(testText1, 'horizontal', emptyPosition, null);
        console.log('测试1 - 空位置横向:', { text: testText1, position: emptyPosition, result: result1 });
        
        // 测试用例2：检查已有诗句位置（不允许重叠）
        if (this.gameState.poems.length > 0) {
            const firstPoem = this.gameState.poems[0];
            const overlapPosition = { ...firstPoem.startPosition };
            const testText2 = '重叠测试';
            const result2 = this.gameState.wouldOverlapExistingPoem(testText2, 'horizontal', overlapPosition, null);
            console.log('测试2 - 重叠位置:', { text: testText2, position: overlapPosition, result: result2 });
        }
        
        // 测试用例3：检查边界
        const boundaryPosition = { x: 98, y: 50 };
        const testText3 = '边界测试';
        const result3 = this.gameState.wouldOverlapExistingPoem(testText3, 'horizontal', boundaryPosition, null);
        console.log('测试3 - 边界位置:', { text: testText3, position: boundaryPosition, result: result3 });
        
        // 测试用例4：检查允许重叠的连接字符位置
        if (this.gameState.poems.length > 0) {
            const firstPoem = this.gameState.poems[0];
            const connectPosition = { x: firstPoem.startPosition.x + 1, y: firstPoem.startPosition.y }; // 假设第二个字符
            const testText4 = '连接测试';
            const result4 = this.gameState.wouldOverlapExistingPoem(testText4, 'vertical', connectPosition, connectPosition);
            console.log('测试4 - 连接字符位置:', { text: testText4, position: connectPosition, result: result4 });
        }
        
        this.gameState.showToast('重叠检测测试完成，请查看控制台', 'info');
    }

    async requestAIPoem(playerPoemId) {
        try {
            // 更新AI状态为思考中
            this.gameState.updateAIStatus('thinking', '查找合适的诗句...');
            this.gameState.showToast('AI正在思考...', 'info');
            
            const result = await ApiService.requestAIPoem(playerPoemId, this.gameState.aiColor);
            
            if (result.success) {
                // 添加AI诗句到本地状态
                this.gameState.addPoem(result.poem);
                
                // 更新AI状态为成功
                const poemText = result.poem.text.length > 10 ? 
                    result.poem.text.substring(0, 10) + '...' : 
                    result.poem.text;
                this.gameState.updateAIStatus('success', poemText);
                this.gameState.showToast('AI接诗成功！', 'success');
                
                console.log('AI接诗成功:', {
                    '诗句': result.poem.text,
                    '位置': result.poem.startPosition,
                    '方向': result.poem.direction
                });
            } else {
                // 更新AI状态为错误
                this.gameState.updateAIStatus('error', result.error || '未知错误');
                this.gameState.showToast('AI接诗失败：' + (result.error || '未知错误'), 'error');
            }
        } catch (error) {
            console.error('AI接诗错误:', error);
            this.gameState.updateAIStatus('error', '网络错误');
            this.gameState.showToast('AI接诗失败', 'error');
        }
    }
}

// 移动端侧边栏控制
class MobileSidebarController {
    constructor() {
        this.init();
    }

    init() {
        const toggleBtn = document.getElementById('mobileSidebarToggle');
        const controlPanel = document.getElementById('controlPanel');
        const overlay = document.getElementById('sidebarOverlay');

        if (!toggleBtn || !controlPanel || !overlay) return;

        // 切换按钮点击事件
        toggleBtn.addEventListener('click', () => {
            this.toggleSidebar();
        });

        // 遮罩层点击事件
        overlay.addEventListener('click', () => {
            this.hideSidebar();
        });

        // 监听屏幕方向变化
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.handleOrientationChange();
            }, 100);
        });

        // 监听窗口大小变化
        window.addEventListener('resize', () => {
            this.handleResize();
        });

        // 添加触摸事件支持
        this.addTouchSupport();
    }

    toggleSidebar() {
        const controlPanel = document.getElementById('controlPanel');
        const overlay = document.getElementById('sidebarOverlay');
        const toggleBtn = document.getElementById('mobileSidebarToggle');

        const isVisible = controlPanel.classList.contains('show');
        
        if (isVisible) {
            this.hideSidebar();
        } else {
            this.showSidebar();
        }
    }

    showSidebar() {
        const controlPanel = document.getElementById('controlPanel');
        const overlay = document.getElementById('sidebarOverlay');
        const toggleBtn = document.getElementById('mobileSidebarToggle');

        controlPanel.classList.add('show');
        overlay.classList.add('show');
        toggleBtn.classList.add('active');
    }

    hideSidebar() {
        const controlPanel = document.getElementById('controlPanel');
        const overlay = document.getElementById('sidebarOverlay');
        const toggleBtn = document.getElementById('mobileSidebarToggle');

        controlPanel.classList.remove('show');
        overlay.classList.remove('show');
        toggleBtn.classList.remove('active');
    }

    handleOrientationChange() {
        // 屏幕方向改变时隐藏侧边栏
        this.hideSidebar();
        
        // 重新调整画布大小
        if (window.gameState) {
            setTimeout(() => {
                window.gameState.resizeCanvas();
                window.gameState.renderCanvas();
            }, 200);
        }
    }

    handleResize() {
        // 如果切换到桌面端，隐藏移动端侧边栏
        if (window.innerWidth > 1024) {
            this.hideSidebar();
        }
        
        // 重新调整画布大小
        if (window.gameState) {
            setTimeout(() => {
                window.gameState.resizeCanvas();
                window.gameState.renderCanvas();
            }, 100);
        }
    }

    addTouchSupport() {
        const canvas = document.getElementById('gameCanvas');
        if (!canvas) return;

        let touchStartX = 0;
        let touchStartY = 0;
        let isTouching = false;

        // 触摸开始
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
            isTouching = true;

            // 模拟鼠标按下事件
            const mouseEvent = new MouseEvent('mousedown', {
                clientX: touch.clientX,
                clientY: touch.clientY,
                bubbles: true
            });
            canvas.dispatchEvent(mouseEvent);
        });

        // 触摸移动
        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (!isTouching) return;

            const touch = e.touches[0];
            
            // 模拟鼠标移动事件
            const mouseEvent = new MouseEvent('mousemove', {
                clientX: touch.clientX,
                clientY: touch.clientY,
                bubbles: true
            });
            canvas.dispatchEvent(mouseEvent);
        });

        // 触摸结束
        canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            if (!isTouching) return;
            
            isTouching = false;
            const touch = e.changedTouches[0];

            // 模拟鼠标抬起事件
            const mouseUpEvent = new MouseEvent('mouseup', {
                clientX: touch.clientX,
                clientY: touch.clientY,
                bubbles: true
            });
            canvas.dispatchEvent(mouseUpEvent);

            // 如果是轻触（没有拖拽），模拟点击事件
            const deltaX = Math.abs(touch.clientX - touchStartX);
            const deltaY = Math.abs(touch.clientY - touchStartY);
            
            if (deltaX < 10 && deltaY < 10) {
                const clickEvent = new MouseEvent('click', {
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                    bubbles: true
                });
                canvas.dispatchEvent(clickEvent);
            }
        });

        // 双指缩放支持
        let initialDistance = 0;
        let initialZoom = 1;

        canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                e.preventDefault();
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                initialDistance = Math.sqrt(
                    Math.pow(touch2.clientX - touch1.clientX, 2) +
                    Math.pow(touch2.clientY - touch1.clientY, 2)
                );
                if (window.gameState) {
                    initialZoom = window.gameState.zoomLevel;
                }
            }
        });

        canvas.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2) {
                e.preventDefault();
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                const currentDistance = Math.sqrt(
                    Math.pow(touch2.clientX - touch1.clientX, 2) +
                    Math.pow(touch2.clientY - touch1.clientY, 2)
                );
                
                if (initialDistance > 0 && window.gameState) {
                    const scale = currentDistance / initialDistance;
                    const newZoom = Math.max(0.1, Math.min(5, initialZoom * scale));
                    window.gameState.zoomLevel = newZoom;
                    window.gameState.updateZoomDisplay();
                    window.gameState.renderCanvas();
                }
            }
        });
    }
}

// 页面加载完成后初始化游戏
document.addEventListener('DOMContentLoaded', () => {
    const game = new JianbingGame();
    window.gameState = game.gameState; // 全局引用以便移动端控制器使用
    new MobileSidebarController();
});
