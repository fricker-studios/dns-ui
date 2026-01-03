# --- build UI ---
FROM node:20 AS ui-build
WORKDIR /ui
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- build API ---
FROM python:3.12.12-slim

# Keeps Python from generating .pyc files in the container
ENV PYTHONDONTWRITEBYTECODE=1

# Turns off buffering for easier container logging
ENV PYTHONUNBUFFERED=1

# Install system dependencies
RUN apt-get update && apt-get install -y \
    nginx \
    bind9 \
    bind9utils \
    bind9-doc \
    dnsutils \
    && rm -rf /var/lib/apt/lists/*

# Set app working directory
WORKDIR /app
RUN touch /etc/bind/managed-zones.conf
RUN mkdir -p /etc/bind/managed-zones

# Copy bind9 configuration files
COPY bind/named.conf.local /etc/bind/named.conf.local

# Install python dependencies
RUN pip install -U pip
RUN pip install poetry==2.2.1
COPY poetry.lock pyproject.toml ./
RUN poetry config virtualenvs.create false && poetry install --no-root

# Copy project
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh
COPY backend ./backend

# UI build output
COPY --from=ui-build /ui/dist /usr/share/nginx/html

# nginx config
COPY nginx/default.conf /etc/nginx/sites-available/default

ENTRYPOINT [ "/app/entrypoint.sh" ]
CMD ["uvicorn", "backend.main:app", "--reload", "--port", "8000"]