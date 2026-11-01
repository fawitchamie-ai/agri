FROM python:3.12-slim
WORKDIR /app
COPY requirements.lock.txt ./
RUN pip install --no-cache-dir -r requirements.lock.txt
COPY runner.py server.py ./
RUN useradd --uid 10001 --create-home crop && mkdir /data && chown crop:crop /data
USER crop
VOLUME ["/data"]
EXPOSE 8091
CMD ["python", "server.py", "--database", "/data/jobs.sqlite", "--host", "0.0.0.0"]
