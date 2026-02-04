# Выводы по чату для продолжения работы

Дата: 2026-02-01

## 1. ✅ Что уже исправлено

### Alembic: «Can't locate revision identified by '008'»

**Проблема:** 
- В контейнере монтировался только `./backend/app`
- Папка `alembic` бралась из образа Docker при сборке
- Файл миграции `008_add_user_machines.py` в образ не попадал
- Alembic не находил ревизию 008

**Решение:** 
В `docker-compose.yml` для сервиса `backend` добавлен volume:
```yaml
volumes:
  - ./backend/alembic:/app/alembic
```

**Статус:** Исправлено. После перезапуска контейнеров (`docker-compose down && docker-compose up -d`) миграции должны работать корректно.

---

## 2. ❌ Что осталось не исправлено

### 500 Internal Server Error на `/api/v1/roasts/references?coffee_hr_id=...&machine=...`

**Ошибка:**
```
TypeError: 'asyncpg.pgproto.pgproto.UUID' object is not subscriptable
```

**Место:** `backend/app/api/v1/endpoints/roasts.py`, функция `list_references`, строки ~302-310

**Код с ошибкой:**
```python
res = await db.execute(select(Coffee.id).where(Coffee.hr_id == coffee_hr_id.strip()).limit(1))
row = res.scalar_one_or_none()
if row:
    resolved_coffee_id = row[0]  # ❌ ОШИБКА: row уже UUID, не нужен [0]
```

**Причина:**
- Метод `.scalar_one_or_none()` возвращает **один скалярный UUID** напрямую
- Код пытается обратиться к `row[0]`, как будто это строка результата
- UUID не поддерживает индексацию → TypeError

**Исправление:**
```python
# Для coffee_hr_id (строки 302-305)
res = await db.execute(select(Coffee.id).where(Coffee.hr_id == coffee_hr_id.strip()).limit(1))
row = res.scalar_one_or_none()
if row:
    resolved_coffee_id = row  # Убрать [0]

# Для blend_hr_id (строки 307-310)
res = await db.execute(select(Blend.id).where(Blend.name == blend_hr_id.strip()).limit(1))
row = res.scalar_one_or_none()
if row:
    resolved_blend_id = row  # Убрать [0]
```

---

## 3. 📋 Дополнительные замечания

### Миграция 008
- Файл: `backend/alembic/versions/008_add_user_machines.py`
- Создает таблицу `user_machines` (каталог машин пользователей)
- Должна применяться после исправления volume в docker-compose

### Возможная проблема с URL без слэша
В логах встречались запросы к `/apiv1/...` (без слэша между `api` и `v1`).
- Возможно, клиент Artisan или другое приложение использует URL без слэша
- При необходимости проверить роутинг и настройки CORS

---

## 4. 🎯 План действий для следующего чата

1. **Проверить Alembic:**
   ```bash
   docker-compose down
   docker-compose up -d
   # Проверить логи:
   docker-compose logs backend | grep -i alembic
   ```

2. **Исправить баг в `roasts.py`:**
   - Строки 302-305: убрать `row[0]`, заменить на `row`
   - Строки 307-310: убрать `row[0]`, заменить на `row`

3. **Проверить эндпоинт `/api/v1/roasts/references`:**
   ```bash
   curl "http://localhost:8000/api/v1/roasts/references?coffee_hr_id=SOME_ID&machine=SOME_MACHINE"
   ```

4. **(Опционально) Проверить роутинг для URL без слэша** между `api` и `v1`

---

## 5. 📁 Файлы для внимания

- `docker-compose.yml` — volume для alembic уже добавлен (строка 34)
- `backend/app/api/v1/endpoints/roasts.py` — функция `list_references` (строки ~300-320)
- `backend/alembic/versions/008_add_user_machines.py` — миграция для user_machines

---

**Статус:** Готово к продолжению в следующем чате.
