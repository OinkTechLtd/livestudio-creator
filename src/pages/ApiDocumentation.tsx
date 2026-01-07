import Header from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Code, Key, Webhook, Gift, Users, BarChart } from "lucide-react";

const ApiDocumentation = () => {
  const baseUrl = "https://aqeleulwobgamdffkfri.supabase.co/rest/v1";

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
            <Code className="w-10 h-10 text-primary" />
            StreamLiveTV API
          </h1>
          <p className="text-lg text-muted-foreground">
            Документация для партнёров и разработчиков
          </p>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Обзор</TabsTrigger>
            <TabsTrigger value="auth">Авторизация</TabsTrigger>
            <TabsTrigger value="channels">Каналы</TabsTrigger>
            <TabsTrigger value="roulette">Рулетка</TabsTrigger>
            <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <Card>
              <CardHeader>
                <CardTitle>Введение</CardTitle>
                <CardDescription>
                  StreamLiveTV API позволяет интегрировать функции платформы в ваши приложения
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Базовый URL</h3>
                  <code className="block bg-muted p-3 rounded-lg text-sm font-mono">
                    {baseUrl}
                  </code>
                </div>
                
                <div>
                  <h3 className="font-semibold mb-2">Возможности API</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                      <Users className="w-5 h-5 text-primary" />
                      <span>Управление подписчиками</span>
                    </div>
                    <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                      <Gift className="w-5 h-5 text-secondary" />
                      <span>Система призов рулетки</span>
                    </div>
                    <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                      <BarChart className="w-5 h-5 text-accent" />
                      <span>Аналитика каналов</span>
                    </div>
                    <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                      <Webhook className="w-5 h-5 text-green-500" />
                      <span>Webhooks уведомления</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Форматы</h3>
                  <p className="text-muted-foreground">
                    Все запросы и ответы используют формат JSON. 
                    Заголовок <code>Content-Type: application/json</code> обязателен для POST/PATCH запросов.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="auth">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="w-5 h-5" />
                  Авторизация
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-2">API Ключи</h3>
                  <p className="text-muted-foreground mb-4">
                    Для доступа к API используйте ключ в заголовке Authorization:
                  </p>
                  <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
{`curl -X GET "${baseUrl}/channels" \\
  -H "apikey: YOUR_ANON_KEY" \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN"`}
                  </pre>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Получение токена</h3>
                  <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
{`POST ${baseUrl}/auth/v1/token?grant_type=password

{
  "email": "user@example.com",
  "password": "your-password"
}

// Ответ:
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_token": "..."
}`}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="channels">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>
                    <Badge className="mr-2">GET</Badge>
                    Получить список каналов
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
{`GET ${baseUrl}/channels?select=*&is_hidden=eq.false

// Ответ:
[
  {
    "id": "uuid",
    "title": "Мой канал",
    "channel_type": "tv",
    "is_live": true,
    "viewer_count": 150,
    "thumbnail_url": "https://...",
    "created_at": "2026-01-01T00:00:00Z"
  }
]`}
                  </pre>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>
                    <Badge className="mr-2">GET</Badge>
                    Получить информацию о канале
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
{`GET ${baseUrl}/channels?id=eq.{channel_id}&select=*

// С подписчиками:
GET ${baseUrl}/channels?id=eq.{channel_id}&select=*,subscriptions(count)`}
                  </pre>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>
                    <Badge className="mr-2">GET</Badge>
                    Получить баллы пользователя
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
{`GET ${baseUrl}/channel_points?channel_id=eq.{channel_id}&user_id=eq.{user_id}

// Ответ:
{
  "id": "uuid",
  "points": 1500,
  "total_watch_time": 7200,
  "messages_sent": 45
}`}
                  </pre>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="roulette">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Gift className="w-5 h-5" />
                    Система рулетки для партнёров
                  </CardTitle>
                  <CardDescription>
                    Интеграция призов от внешних партнёров
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h3 className="font-semibold mb-2">Добавление приза через API</h3>
                    <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
{`POST ${baseUrl}/roulette_prizes

{
  "channel_id": "{channel_id}",
  "title": "Скидка 20% от партнёра",
  "description": "Промокод на скидку",
  "prize_type": "promocode",
  "prize_value": "PARTNER2026",
  "chance_percent": 5.00,
  "is_active": true
}`}
                    </pre>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2">Получение выигрышей канала</h3>
                    <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
{`GET ${baseUrl}/roulette_spins?channel_id=eq.{channel_id}&order=spun_at.desc

// Ответ:
[
  {
    "id": "uuid",
    "user_id": "user-uuid",
    "prize_title": "100 баллов",
    "promocode": null,
    "spun_at": "2026-01-06T12:00:00Z",
    "was_free": false
  }
]`}
                    </pre>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2">Типы призов</h3>
                    <div className="grid gap-2">
                      <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                        <Badge variant="outline">internal</Badge>
                        <span>Баллы канала (prize_value = количество)</span>
                      </div>
                      <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                        <Badge variant="outline">promocode</Badge>
                        <span>Статический промокод</span>
                      </div>
                      <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                        <Badge variant="outline">partner_api</Badge>
                        <span>Динамический промокод через ваш API</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Партнёрский API для промокодов</CardTitle>
                  <CardDescription>
                    Настройка динамической генерации промокодов
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
{`// Ваш сервер должен принимать POST запросы:
POST https://your-api.com/generate-promocode

// Запрос от StreamLiveTV:
{
  "channel_id": "channel-uuid",
  "user_id": "user-uuid",
  "prize_id": "prize-uuid",
  "timestamp": "2026-01-06T12:00:00Z"
}

// Ожидаемый ответ:
{
  "success": true,
  "promocode": "UNIQUE-PROMO-123",
  "expires_at": "2026-02-06T12:00:00Z"
}`}
                  </pre>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="webhooks">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Webhook className="w-5 h-5" />
                  Webhooks
                </CardTitle>
                <CardDescription>
                  Получайте уведомления о событиях в реальном времени
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-2">Доступные события</h3>
                  <div className="grid gap-2">
                    <div className="p-3 bg-muted rounded-lg">
                      <code className="text-primary">subscription.created</code>
                      <p className="text-sm text-muted-foreground mt-1">
                        Новая подписка на канал
                      </p>
                    </div>
                    <div className="p-3 bg-muted rounded-lg">
                      <code className="text-primary">roulette.spin</code>
                      <p className="text-sm text-muted-foreground mt-1">
                        Пользователь прокрутил рулетку
                      </p>
                    </div>
                    <div className="p-3 bg-muted rounded-lg">
                      <code className="text-primary">premium.purchased</code>
                      <p className="text-sm text-muted-foreground mt-1">
                        Покупка премиум подписки за баллы
                      </p>
                    </div>
                    <div className="p-3 bg-muted rounded-lg">
                      <code className="text-primary">channel.live</code>
                      <p className="text-sm text-muted-foreground mt-1">
                        Канал начал трансляцию
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Пример payload</h3>
                  <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
{`{
  "event": "roulette.spin",
  "timestamp": "2026-01-06T12:00:00Z",
  "data": {
    "channel_id": "channel-uuid",
    "user_id": "user-uuid",
    "prize": {
      "id": "prize-uuid",
      "title": "Партнёрский приз",
      "type": "partner_api"
    }
  },
  "signature": "sha256=..."
}`}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default ApiDocumentation;
