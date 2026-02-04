# Проверка синхронизации обжарок Artisan → Сайт

## Что изменено

### Backend (test-server-qqplus)
- **Обработка blend**: Artisan отправляет `blend` как объект `{label, ingredients}`. Сервер сохраняет его в `blend_spec`, не ищет запись в таблице `blends`.
- **Списание по blend_spec**: При blend-обжарке списание идёт по ингредиентам (coffee hr_id + ratio).

### Artisan (artisan-for-QQ-master)
- **Телеметрия в payload**: В POST добавляются `timex`, `temp1`, `temp2`, `air`, `drum`, `gas`, `computed`, `specialevents` и др.
- **Графики**: Данные для графиков теперь приходят с обжаркой, без ручной загрузки .alog.

---

## Инструкция по проверке

### 1. Запуск сервера

```powershell
cd C:\Users\ilaku\Documents\Projects\test-server-qqplus
docker-compose up -d --build
```

Подожди ~15 секунд, пока стартуют контейнеры. Backend: `http://localhost:8000`, Frontend: `http://localhost:5173`.

### 2. Настройка Artisan Desktop

1. Открой Artisan Desktop.
2. Зайди в **Plus** (Settings → Plus или соответствующее меню).
3. Укажи:
   - **Server URL**: `http://localhost:8000/apiv1`
   - **Логин/пароль**: `admin@test.com` / `admin123` (или свой пользователь).
4. Сохрани настройки и при необходимости перезапусти Artisan.

### 3. Подготовка обжарки в Artisan

1. Выбери или загрузи профиль обжарки (с телеметрией: timex, temp1, temp2).
2. Можно использовать blend (Store → Blend) или single coffee.
3. Проверь, что в Plus выбраны Store и Coffee/Blend.

### 4. Сохранение и синхронизация

1. Сохрани профиль (File → Save) или заверши обжарку.
2. Artisan отправит roast на сервер автоматически (очередь Plus).
3. Смотри лог Artisan на наличие ошибок.

### 5. Проверка на сайте

1. Открой `http://localhost:5173`.
2. Войди под `admin@test.com` / `admin123`.
3. Перейди в **Roasts**.
4. При необходимости удали старые обжарки — иконка корзины (Trash) справа от каждой карточки. Подтверди удаление.
4. Убедись, что новая обжарка появилась в списке.
5. Открой карточку обжарки.
6. Проверь:
   - **Сводка** (батч, кофе/blend, вес, дата и т.д.).
   - **График** — должны отображаться кривые ET, BT, RoR и события (Charge, TP, Dry, FC, Drop).
   - **Фазы** — Сушка, Маяр, Развитие с процентами.

### 6. Проверка логов backend

```powershell
docker logs test-server-qqplus-backend-1 --tail 100
```

Успешный запрос:
```
POST /apiv1/roasts HTTP/1.1" 201 Created
```

Ошибки (500, 404 и т.д.) будут видны в этих логах.

### 7. Проверка blend-обжарки

1. В Artisan создай обжарку с Blend (не single coffee).
2. Blend должен быть вида: `{label: "…", ingredients: [{coffee: "C1001", ratio: 0.5}, ...]}`.
3. Сервер должен принять такой payload без 500.
4. На сайте обжарка показывается с составом бленда.

---

## Возможные проблемы

| Проблема | Решение |
|----------|---------|
| 404 на `/apiv1/roasts` | Проверь URL в Artisan: `http://localhost:8000/apiv1` (без `/api/v1`). |
| 401 Unauthorized | Проверь логин/пароль. Создай пользователя на сайте, если его нет. |
| 500 Internal Server Error | Смотри `docker logs test-server-qqplus-backend-1`. Пришли стек ошибки. |
| Нет графика на странице обжарки | Убедись, что в профиле Artisan есть `timex`, `temp1`, `temp2`. Обжарка должна быть с реальной телеметрией. |
| Blend даёт 500 | Проверь формат: `blend` — объект `{label, ingredients}`, не строка. |

---

## Ручная проверка API (PowerShell)

```powershell
# Логин
$login = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/auth/login" -Method POST -ContentType "application/json" -Body '{"email":"admin@test.com","password":"admin123"}'
$token = $login.data.token

# Список обжарок
Invoke-RestMethod -Uri "http://localhost:8000/api/v1/roasts?limit=5" -Headers @{Authorization="Bearer $token"}

# Конкретная обжарка (подставь ID)
Invoke-RestMethod -Uri "http://localhost:8000/api/v1/roasts/<ROAST_ID>" -Headers @{Authorization="Bearer $token"}
```

В ответе на `/roasts/<id>` должно быть поле `telemetry` с `timex`, `temp1`, `temp2` и т.д., если обжарка пришла с телеметрией.
