# DomExit Multi-Messenger Architecture: MAX Switch Guide
*Руководство по архитектуре и переключению на мессенджер MAX*

## 1. Архитектурный обзор (Multi-Messenger Adapter Pattern)

Платформа **DomExit** спроектирована с изоляцией транспортного уровня коммуникаций. Интерактивные уведомления, кураторские чаты и оповещения команды абстрагированы через единый интерфейс `IMessengerProvider`.

```
                    ┌─────────────────────────┐
                    │  NotificationDispatcher │
                    └───────────┬─────────────┘
                                │
                    ┌───────────▼─────────────┐
                    │    messengerRegistry    │
                    └───────────┬─────────────┘
                                │
            ┌───────────────────┴───────────────────┐
            ▼                                       ▼
  ┌───────────────────┐                   ┌───────────────────┐
  │ TelegramProvider  │                   │    MaxProvider    │
  │ (Current default) │                   │ (Ready for launch)│
  └───────────────────┘                   └───────────────────┘
```

### Ключевые файлы реализации:
- `backend/src/lib/messenger/IMessengerProvider.ts` — типизированный контракт провайдеров мессенджеров.
- `backend/src/lib/messenger/TelegramProvider.ts` — адаптер Telegram Bot API (с поддержкой inline webhooks и ответов).
- `backend/src/lib/messenger/MaxProvider.ts` — нативный адаптер для Bot API мессенджера MAX с безопасным режимом симуляции.
- `backend/src/lib/messenger/messengerRegistry.ts` — реестр провайдеров и фабрика активного клиента (`getActiveMessenger()`).
- `backend/src/routes/messenger.ts` — маршруты статуса (`/api/messenger/status`) и вебхуков (`/api/messenger/max/webhook`).

---

## 2. Как переключить платформу на MAX (1-Click Switch)

Для переключения платформы с Telegram на MAX **не требуется изменять или перекомпилировать исходный код**. Достаточно обновить переменные окружения в Yandex Cloud Functions:

### Переменные окружения:
| Переменная | Значение по умолчанию | Значение для MAX | Описание |
|---|---|---|---|
| `MESSENGER_PROVIDER` | `telegram` | `max` | **Главный переключатель активного мессенджера** |
| `MAX_BOT_TOKEN` | *пусто* | `token_полученный_в_MAX` | Секретный токен авторизации бота MAX |
| `MAX_BOT_USERNAME` | *пусто* | `domexit_bot` | Имя пользователя бота в MAX |
| `MAX_WEBHOOK_SECRET` | *пусто* | `произвольный_хеш_sha256` | Заголовок `x-max-bot-api-secret` для валидации вебхука |
| `MAX_API_BASE_URL` | `https://api.max.im/v1` | `https://api.max-messenger.ru/bot/v1` | Базовый URL API платформы MAX |

### Команда обновления через `yc` CLI (Staging):
```bash
yc serverless function version create \
  --function-name domexit-backend-staging \
  --runtime nodejs20 \
  --entrypoint dist/index.handler \
  --memory 256m \
  --execution-timeout 10s \
  --environment MESSENGER_PROVIDER=max,MAX_BOT_TOKEN="ВАШ_ТОКЕН",MAX_API_BASE_URL="https://api.max-messenger.ru/bot/v1"
```

---

## 3. Поведение Webhook-эндпоинта MAX (`/api/messenger/max/webhook`)

- **Когда активен Telegram (`MESSENGER_PROVIDER=telegram`):**
  Запросы на `POST /api/messenger/max/webhook` корректно возвращают:
  ```json
  HTTP/1.1 503 Service Unavailable
  {
    "ok": false,
    "message": "MAX messenger integration is ready on the backend but waiting for active provider configuration (MESSENGER_PROVIDER=max)",
    "activeProvider": "telegram"
  }
  ```
- **Когда активен MAX (`MESSENGER_PROVIDER=max`):**
  Маршрут проверяет секрет `MAX_WEBHOOK_SECRET` (заголовок `x-max-bot-api-secret`), нормализует входящее событие через `maxProvider.parseWebhookPayload` и передает в диспетчер платформы.

---

## 4. Проверка статуса мессенджеров

Для мониторинга активного мессенджера в runtime доступен легковесный эндпоинт:
```http
GET /api/messenger/status
```
Ответ:
```json
{
  "ok": true,
  "activeProvider": "telegram",
  "isConfigured": true,
  "supportedProviders": ["telegram", "max", "mock"]
}
```

---

## 5. Независимость ПЭП 63-ФЗ от мессенджеров

Благодаря Фазе 8А:
- **Email является основным и достаточным каналом доставки OTP для 63-ФЗ**.
- Пользователи могут подписывать акты осмотра, NDA и эксклюзивные соглашения без обязательной привязки к Telegram или MAX.
- Интеграция с мессенджерами сохраняется как удобный дополнительный канал для пользователей, связавших свои аккаунты.
