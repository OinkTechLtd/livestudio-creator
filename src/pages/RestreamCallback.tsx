import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Status = "loading" | "error" | "success";

export default function RestreamCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState<string>("Подключаем Restream…");

  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const code = params.get("code");
  const channelId = params.get("state");
  const oauthError = params.get("error") || params.get("error_description");

  useEffect(() => {
    const run = async () => {
      try {
        if (oauthError) {
          setStatus("error");
          setMessage(String(oauthError));
          return;
        }

        if (!code || !channelId) {
          setStatus("error");
          setMessage("Не хватает параметров OAuth (code/state).");
          return;
        }

        const { data, error } = await supabase.functions.invoke("restream-oauth-callback", {
          body: {
            code,
            channelId,
            redirectUri: `${window.location.origin}/restream/callback`,
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        setStatus("success");
        setMessage("✅ Restream подключён. Перенаправляем в канал…");
        navigate(`/channel/${channelId}?restream=success`, { replace: true });
      } catch (e: any) {
        setStatus("error");
        setMessage(e?.message || "Ошибка подключения Restream");
      }
    };

    run();
  }, [code, channelId, oauthError, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Restream OAuth</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{message}</p>

          {status === "error" && (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => navigate("/", { replace: true })}>
                На главную
              </Button>
              {channelId && (
                <Button variant="outline" onClick={() => navigate(`/channel/${channelId}`, { replace: true })}>
                  В канал
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
