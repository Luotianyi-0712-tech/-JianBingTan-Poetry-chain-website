#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
简单的测试文件
"""

def test_import():
    """测试导入"""
    try:
        from flask import Flask
        print("✓ Flask导入成功")
        return True
    except ImportError as e:
        print(f"✗ Flask导入失败: {e}")
        return False

def test_app_creation():
    """测试应用创建"""
    try:
        from flask import Flask
        app = Flask(__name__)
        print("✓ Flask应用创建成功")
        return True
    except Exception as e:
        print(f"✗ Flask应用创建失败: {e}")
        return False

def test_template_loading():
    """测试模板加载"""
    try:
        import os
        if os.path.exists('templates/index.html'):
            print("✓ HTML模板文件存在")
            return True
        else:
            print("✗ HTML模板文件不存在")
            return False
    except Exception as e:
        print(f"✗ 模板检查失败: {e}")
        return False

def test_static_files():
    """测试静态文件"""
    try:
        import os
        css_exists = os.path.exists('static/style.css')
        js_exists = os.path.exists('static/script.js')
        
        if css_exists and js_exists:
            print("✓ 静态文件存在")
            return True
        else:
            print(f"✗ 静态文件缺失 - CSS: {css_exists}, JS: {js_exists}")
            return False
    except Exception as e:
        print(f"✗ 静态文件检查失败: {e}")
        return False

if __name__ == '__main__':
    print("开始测试煎饼摊诗词接龙游戏项目...")
    print("=" * 50)
    
    tests = [
        test_import,
        test_app_creation,
        test_template_loading,
        test_static_files
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        if test():
            passed += 1
        print()
    
    print("=" * 50)
    print(f"测试完成: {passed}/{total} 通过")
    
    if passed == total:
        print("🎉 所有测试通过！项目配置正确。")
        print("\n启动说明:")
        print("1. 确保Python环境正确")
        print("2. 运行: python app.py")
        print("3. 访问: http://localhost:5000")
    else:
        print("❌ 部分测试失败，请检查项目配置。")




