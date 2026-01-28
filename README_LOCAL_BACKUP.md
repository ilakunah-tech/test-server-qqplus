# Artisan+ Local Server

Локальный аналог artisan.plus для синхронизации с Artisan desktop приложением.

## 🚀 Быстрый старт

### Требования
- Docker и Docker Compose
- Git

### Запуск проекта

1. Клонируйте репозиторий (или используйте текущую директорию)

2. Запустите все сервисы одной командой:
```bash
docker-compose up --build
```

3. Дождитесь запуска всех сервисов (обычно 1-2 минуты)

4. Откройте в браузере:
   - **Frontend**: http://localhost:5173
   - **Backend API Docs**: http://localhost:8000/docs (Swagger UI)
   - **PostgreSQL**: localhost:5432

### Тестовые учетные данные:
- **Email**: `admin@test.com`
- **Password**: `admin123`

> При первом запуске автоматически создаются миграции БД и seed данные (5 coffees, 5 batches, 15 roasts, 8 schedule items).

## 📋 Функциональность

- ✅ Полная совместимость API с artisan.plus
- ✅ Управление инвентарем (coffees, batches)
- ✅ Записи обжарок (roasts) с загрузкой .alog файлов
- ✅ Расписание обжарок (schedule)
- ✅ Многопользовательская система с JWT аутентификацией
- ✅ WebSocket для real-time уведомлений
- ✅ Красивый UI в стиле QQ Coffee

## 🔌 Синхронизация с Artisan Desktop

В Artisan desktop настрой:

```python
# src/plus/config.py
QQROAST_HOST = "localhost"
QQROAST_PORT = 8000
QQROAST_SCHEME = "http"
```

## 🌐 Миграция на интернет-сервер

1. Замени `localhost` на IP/домен сервера в `docker-compose.yml`
2. Настрой Nginx reverse proxy
3. Используй PostgreSQL (уже настроен)
4. Измени `QQROAST_SCHEME` на `https`
5. Обнови `CORS_ORIGINS` в `.env`

## 📚 API Documentation

Swagger UI: http://localhost:8000/docs

## 🛠 Технологии

- **Backend**: FastAPI, SQLAlchemy (async), PostgreSQL, Alembic
- **Frontend**: React 18, TypeScript, Vite, shadcn/ui, Tailwind CSS
- **DevOps**: Docker, docker-compose

## 📝 Лицензия

MIT
