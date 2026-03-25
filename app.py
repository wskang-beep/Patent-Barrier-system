import streamlit as st
import streamlit.components.v1 as components

st.set_page_config(layout="wide")

# 1. 데이터 읽기
def get_csv_content(file_path):
    try:
        # 한국어 엑셀 export는 대부분 cp949/euc-kr입니다.
        with open(file_path, "r", encoding="cp949") as f:
            return f.read().replace("`", "'") # JS 템플릿 리터럴 충돌 방지
    except:
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read().replace("`", "'")

barrier_data = get_csv_content("특허 장벽 리스트.csv")
trend_data = get_csv_content("월 별 출원 건 수.csv")

# 2. 파일 읽기
with open("style.css", "r", encoding="utf-8") as f:
    css_code = f.read()
with open("index.html", "r", encoding="utf-8") as f:
    html_code = f.read()
with open("analysis.js", "r", encoding="utf-8") as f:
    js_code = f.read()

# 3. 데이터 주입 (코드 치환)
# analysis.js 내의 자리표시자(__BARRIER_DATA__)를 실제 데이터로 바꿉니다.
js_code = js_code.replace("`__BARRIER_DATA__`", f" `{barrier_data}` ")
js_code = js_code.replace("`__TREND_DATA__`", f" `{trend_data}` ")

# 4. HTML 통합
final_html = f"""
<style>{css_code}</style>
{html_code}
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js"></script>
<script>{js_code}</script>
"""

components.html(final_html, height=1200, scrolling=True)
