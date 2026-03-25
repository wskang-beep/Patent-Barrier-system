import streamlit as st
import streamlit.components.v1 as components

# HTML 파일을 읽어서 Streamlit 화면에 뿌려주는 방식
with open("index.html", "r", encoding="utf-8") as f:
    html_code = f.read()

st.set_page_config(layout="wide")
components.html(html_code, height=800, scrolling=True)
