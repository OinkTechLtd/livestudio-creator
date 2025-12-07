import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Bug, Zap, Shield, Layout } from "lucide-react";

interface ChangelogEntry {
  version: string;
  date: string;
  type: "feature" | "fix" | "improvement" | "security";
  changes: string[];
}

const changelog: ChangelogEntry[] = [
  {
    version: "1.9.0",
    date: "2024-12-07",
    type: "feature",
    changes: [
      "Добавлена полоса прогресса воспроизведения с названием медиа и временем",
      "Добавлена возможность скачать m3u файл плейлиста для IPTV приложений",
      "Добавлен предпросмотр видео при наведении на карточку канала",
      "Исправлена ошибка RLS при загрузке рекламных роликов",
      "Создана страница истории обновлений",
      "Улучшена стабильность WebView приложений",
      "Исправлено воспроизведение плейлиста - теперь все видео играют по порядку",
      "Исправлены ограничения чата для подписчиков",
      "Исправлена блокировка пользователей в чате",
    ],
  },
  {
    version: "1.8.0",
    date: "2024-12-06",
    type: "feature",
    changes: [
      "Добавлена статистика качества соединения WebRTC для стримеров",
      "Добавлено уведомление владельцу при подключении зрителя",
      "Добавлена сортировка медиафайлов drag-and-drop",
      "Добавлены кнопки 'Все в эфир' и 'Перемешать' для плейлиста",
    ],
  },
  {
    version: "1.7.0",
    date: "2024-12-05",
    type: "feature",
    changes: [
      "Добавлена система рекламных пауз с настраиваемым интервалом",
      "Добавлена поддержка торрент-файлов для загрузки контента",
      "Улучшена синхронизация воспроизведения для всех зрителей",
      "Добавлена поддержка TURN серверов для WebRTC",
    ],
  },
  {
    version: "1.6.0",
    date: "2024-12-04",
    type: "feature",
    changes: [
      "Добавлены кнопки принять/отклонить в уведомлениях о приглашениях",
      "Добавлена функция перемешивания плейлиста",
      "Улучшено кэширование для WebView приложений",
      "Добавлен автоматический повтор плейлиста",
    ],
  },
  {
    version: "1.5.0",
    date: "2024-12-03",
    type: "feature",
    changes: [
      "Добавлена система приглашения участников канала с ролями",
      "Добавлен чат-бот с автоматическими сообщениями",
      "Добавлена система баллов и наград за просмотр",
      "Добавлены настройки уведомлений в профиле",
    ],
  },
  {
    version: "1.4.0",
    date: "2024-12-02",
    type: "feature",
    changes: [
      "Добавлена поддержка 10+ языков интерфейса",
      "Добавлена панель администратора для модерации",
      "Добавлены ограничения чата для подписчиков",
      "Добавлено расписание трансляций канала",
    ],
  },
  {
    version: "1.3.0",
    date: "2024-12-01",
    type: "feature",
    changes: [
      "Добавлен живой чат с модерацией",
      "Добавлена система модераторов канала",
      "Добавлено закрепление сообщений в чате",
      "Добавлена блокировка пользователей",
      "Добавлен попаут-плеер для отдельного окна",
    ],
  },
  {
    version: "1.2.0",
    date: "2024-11-30",
    type: "feature",
    changes: [
      "Добавлена трансляция экрана через WebRTC",
      "Добавлено голосовое вещание для радио",
      "Добавлен HLS плеер для m3u8 потоков",
      "Добавлена генерация m3u8 плейлиста канала",
      "Добавлена поддержка PWA для установки",
    ],
  },
  {
    version: "1.1.0",
    date: "2024-11-29",
    type: "feature",
    changes: [
      "Добавлена система донатов для каналов",
      "Добавлена поддержка внешних URL источников",
      "Добавлен встраиваемый плеер (embed)",
      "Добавлена аналитика просмотров канала",
      "Добавлена система жалоб на контент",
    ],
  },
  {
    version: "1.0.0",
    date: "2024-11-28",
    type: "feature",
    changes: [
      "Запуск StreamLiveTV Beta",
      "Создание TV каналов и радиостанций",
      "Загрузка медиа контента",
      "Live стриминг через Mux/OBS",
      "Система подписок на каналы",
      "Лайки и дизлайки",
      "Комментарии к каналам",
      "Профили пользователей",
      "Поиск каналов",
      "Избранные каналы",
      "Ограничение хранилища 5GB на пользователя",
    ],
  },
];

const getTypeIcon = (type: string) => {
  switch (type) {
    case "feature":
      return <Sparkles className="w-4 h-4" />;
    case "fix":
      return <Bug className="w-4 h-4" />;
    case "improvement":
      return <Zap className="w-4 h-4" />;
    case "security":
      return <Shield className="w-4 h-4" />;
    default:
      return <Layout className="w-4 h-4" />;
  }
};

const getTypeBadge = (type: string) => {
  switch (type) {
    case "feature":
      return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Новое</Badge>;
    case "fix":
      return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">Исправление</Badge>;
    case "improvement":
      return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">Улучшение</Badge>;
    case "security":
      return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Безопасность</Badge>;
    default:
      return null;
  }
};

const Changelog = () => {
  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">История обновлений</h1>
          <p className="text-muted-foreground">
            Все изменения и новые функции StreamLiveTV
          </p>
        </div>

        <ScrollArea className="h-[calc(100vh-250px)]">
          <div className="space-y-6 pr-4">
            {changelog.map((entry) => (
              <Card key={entry.version} className="border-l-4 border-l-primary">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-xl flex items-center gap-2">
                        {getTypeIcon(entry.type)}
                        v{entry.version}
                      </CardTitle>
                      {getTypeBadge(entry.type)}
                    </div>
                    <span className="text-sm text-muted-foreground">{entry.date}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {entry.changes.map((change, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <span className="text-primary mt-1">•</span>
                        <span>{change}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </main>
    </div>
  );
};

export default Changelog;