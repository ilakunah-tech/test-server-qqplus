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

---

## ✅ Реализовано (v0.2)

### Backend
- ✅ **PostgreSQL Database Schema** (ЭТАП 1) - 28.01.2026
  - 6 таблиц: users, coffees, batches, schedules, roasts, alembic_version
  - 8 foreign keys с правильными каскадами
  - 18 индексов для оптимизации запросов
  - Check constraints для валидации данных

- ✅ **REST API (20+ endpoints)** (ЭТАП 2) - 28.01.2026
  - ✅ Inventory API (coffees, batches) - полный CRUD
  - ✅ Schedules API (планирование обжарок)
  - ✅ Roasts API (история обжарок) с .alog файлами
  - ✅ **Idempotency**: UUID от клиента для roasts
  - ✅ **Atomic operations**: SELECT FOR UPDATE для batch deduction
  - ✅ **Auto-complete**: schedules обновляются при создании roast
  - ✅ **Batch restoration**: восстановление веса при DELETE roast
  - ✅ Health check endpoints

### Ключевые особенности
- 🔒 **Concurrency Safety**: предотвращение race conditions
- 🔄 **Idempotency**: повторные запросы безопасны
- ⚛️ **ACID Transactions**: атомарность критичных операций
- 🛡️ **Type Safety**: Decimal для весов, Pydantic валидация
- 📊 **Filtering & Pagination**: гибкие запросы с фильтрами

---

## 🔜 В разработке

- ⏳ **ЭТАП 3**: Desktop Artisan - Batches Integration (#26)
- ⏳ **ЭТАП 4**: Desktop Artisan - Schedules Integration (#27)
- ⏳ **ЭТАП 5**: Desktop Artisan - Roast Sync + Offline Mode (#28)
- ⏳ **ЭТАП 6**: Testing & Documentation (#29)
- ⏳ **Notifications System** (#23) - Email/Push уведомления

**Progress**: 2/7 этапов завершено (29%)

---

## 📋 API Endpoints

### Inventory
```
GET    /api/v1/inventory/coffees
POST   /api/v1/inventory/coffees
GET    /api/v1/inventory/coffees/{id}
PUT    /api/v1/inventory/coffees/{id}
DELETE /api/v1/inventory/coffees/{id}

GET    /api/v1/inventory/batches
POST   /api/v1/inventory/batches
GET    /api/v1/inventory/batches/{id}
PUT    /api/v1/inventory/batches/{id}
DELETE /api/v1/inventory/batches/{id}
PUT    /api/v1/inventory/batches/{id}/deduct  ⭐ Атомарное списание
```

### Schedules
```
GET    /api/v1/schedule/schedule
POST   /api/v1/schedule/schedule
GET    /api/v1/schedule/schedule/{id}
PUT    /api/v1/schedule/schedule/{id}
DELETE /api/v1/schedule/schedule/{id}
```

### Roasts
```
GET    /api/v1/roasts/roasts
POST   /api/v1/roasts/roasts  ⭐ UUID от клиента + идемпотентность
GET    /api/v1/roasts/{id}
DELETE /api/v1/roasts/{id}  ⭐ Восстановление batch
POST   /api/v1/roasts/{id}/upload-profile
GET    /api/v1/roasts/{id}/profile
```

### Health
```
GET /health
GET /ping
```

---

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

## 📈 История изменений

### v0.2 (28.01.2026)
- ✅ Database schema migration завершён
- ✅ Backend REST API полностью реализован
- ✅ Idempotency и atomic operations
- ✅ 10+ тестов пройдено в Swagger UI

### v0.1 (Январь 2026)
- ✅ Базовая структура проекта
- ✅ Docker setup
- ✅ Frontend UI

## 📝 Лицензия

MIT

---

**Последнее обновление**: 28 января 2026  
**Статус**: 🟢 Active Development