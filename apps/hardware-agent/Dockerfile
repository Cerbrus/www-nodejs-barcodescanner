FROM debian:trixie-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-evdev python3-libgpiod \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY agent.py .

ENV PYTHONUNBUFFERED=1
CMD ["python3", "agent.py"]
