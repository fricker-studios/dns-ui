FROM python:3.12.12-slim

# Keeps Python from generating .pyc files in the container
ENV PYTHONDONTWRITEBYTECODE=1

# Turns off buffering for easier container logging
ENV PYTHONUNBUFFERED=1

# Install system dependencies
RUN set -eux; \
    # Prefer HTTPS (avoids flaky/blocked port 80 to CDN edges)
    if [ -f /etc/apt/sources.list ]; then \
      sed -i 's|http://deb.debian.org|https://deb.debian.org|g; s|http://security.debian.org|https://security.debian.org|g' /etc/apt/sources.list; \
    fi; \
    if [ -d /etc/apt/sources.list.d ]; then \
      find /etc/apt/sources.list.d -type f \( -name "*.list" -o -name "*.sources" \) -print0 \
        | xargs -0 -r sed -i 's|http://deb.debian.org|https://deb.debian.org|g; s|http://security.debian.org|https://security.debian.org|g'; \
    fi; \
    apt-get -o Acquire::Retries=5 -o Acquire::https::Timeout=30 -o Acquire::http::Timeout=30 update; \
    apt-get install -y --no-install-recommends \
      nginx \
      bind9 \
      bind9utils \
      bind9-doc \
      dnsutils; \
    rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -u 1000 -s /bin/bash appuser

# Set app working directory
WORKDIR /app
RUN touch /etc/bind/managed-zones.conf
RUN mkdir -p /etc/bind/managed-zones

# Copy bind9 configuration files
COPY bind/named.conf.local /etc/bind/named.conf.local
COPY bind/named.conf.options /etc/bind/named.conf.options

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
COPY frontend/dist /usr/share/nginx/html

# nginx config
COPY nginx/default.conf /etc/nginx/sites-available/default
COPY nginx/nginx.conf /etc/nginx/nginx.conf

# Create sites-enabled symlink
RUN mkdir -p /etc/nginx/sites-enabled \
    && ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default

# Set ownership and permissions for bind9 directories (OpenShift-compatible)
RUN chown -R appuser:0 /etc/bind \
    && chmod -R 775 /etc/bind \
    && mkdir -p /var/cache/bind /var/run/named \
    && chown -R appuser:0 /var/cache/bind /var/run/named \
    && chmod -R 775 /var/cache/bind /var/run/named

# Set ownership and permissions for nginx directories (OpenShift-compatible)
RUN chown -R appuser:0 /var/lib/nginx /var/log/nginx \
    && chmod -R 775 /var/lib/nginx /var/log/nginx \
    && mkdir -p /usr/share/nginx/html \
    && chown -R appuser:0 /usr/share/nginx/html \
    && sed -i 's/^user .*/user appuser;/' /etc/nginx/nginx.conf \
    && chown -R appuser:0 /etc/nginx/sites-available/default /etc/nginx/nginx.conf

# Set ownership for app directory (OpenShift-compatible)
RUN chown -R appuser:0 /app \
    && chmod -R g=u /app /etc/bind /var/cache/bind /var/run/named /var/lib/nginx /var/log/nginx /usr/share/nginx/html

# Switch to non-root user
USER appuser

# Expose ports
EXPOSE 8000 53/udp 53/tcp

ENTRYPOINT [ "/app/entrypoint.sh" ]
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]