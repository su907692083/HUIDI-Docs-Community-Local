FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
COPY web ./web
ENV APP_HOST=0.0.0.0 APP_PORT=8080
EXPOSE 8080
CMD ["uvicorn","app.online_app:app","--host","0.0.0.0","--port","8080"]