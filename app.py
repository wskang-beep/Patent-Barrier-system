import streamlit as st
import streamlit.components.v1 as components
import os

# 페이지 설정 (가장 상단에 위치해야 합니다)
st.set_page_config(layout="wide")

def load_app():
    # 1. 파일 읽기 (경로 및 인코딩 예외 처리)
    try:
        with open("style.css", "r", encoding="utf-8") as f:
            css_content = f.read()
        with open("index.html", "r", encoding="utf-8") as f:
            html_content = f.read()
        
        # CSV 데이터 읽기 (JS에서 사용할 수 있게 텍스트로 가져옴)
        # 파일명이 한글일 경우 경로 인식을 위해 명시적으로 지정
        with open("월 별 출원 건 수.csv", "r", encoding="utf-8") as f:
            csv_data_1 = f.read()
        with open("특허 장벽 리스트.csv", "r", encoding="utf-8") as f:
            csv_data_2 = f.read()
            
    except FileNotFoundError as e:
        st.error(f"파일을 찾을 수 없습니다: {e}")
        return

    # 2. HTML 내부에 CSS와 데이터를 강제로 주입 (Injection)
    # index.html의 <head> 태그 바로 뒤에 스타일과 데이터를 삽입합니다.
    injection_code = f"""
    <style>{css_content}</style>
    <script>
        // JS 변수로 데이터를 미리 선언해버립니다.
        window.csvData_Monthly = `{csv_data_1}`;
        window.csvData_Barrier = `{csv_data_2}`;
        console.log("데이터 주입 완료");
    </script>
    """
    
    # <head> 태그 위치에 코드를 삽입
    final_html = html_content.replace("<head>", f"<head>{injection_code}")

    # 3. 통합된 HTML 출력
    # height는 화면에 맞게 조절하세요.
    components.html(final_html, height=1000, scrolling=True)

if __name__ == "__main__":
    load_app()
