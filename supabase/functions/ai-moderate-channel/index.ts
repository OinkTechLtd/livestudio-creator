import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const { channelId, action } = await req.json();

    if (!channelId) {
      throw new Error("channelId is required");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch channel details
    const { data: channel, error: channelError } = await supabase
      .from("channels")
      .select("id, title, description, channel_type, is_hidden, hidden_reason")
      .eq("id", channelId)
      .single();

    if (channelError || !channel) {
      throw new Error("Channel not found");
    }

    // Fetch recent reports for this channel
    const { data: reports, error: reportsError } = await supabase
      .from("reports")
      .select("reason, description, status, is_verified")
      .eq("channel_id", channelId)
      .order("created_at", { ascending: false })
      .limit(20);

    // Fetch recent chat messages for context
    const { data: messages } = await supabase
      .from("chat_messages")
      .select("message")
      .eq("channel_id", channelId)
      .order("created_at", { ascending: false })
      .limit(50);

    // Build context for AI moderation
    const reportsContext = reports?.length
      ? reports.map(r => `- ${r.reason}: ${r.description || "no details"} (verified: ${r.is_verified})`).join("\n")
      : "No reports found.";

    const messagesContext = messages?.length
      ? messages.map(m => m.message).slice(0, 30).join("\n")
      : "No recent chat messages.";

    const prompt = `Вы — AI модератор для платформы StreamLiveTV. Проанализируйте канал и примите решение о модерации.

Информация о канале:
- ID: ${channel.id}
- Название: ${channel.title}
- Описание: ${channel.description || "Нет описания"}
- Тип: ${channel.channel_type}
- Скрыт: ${channel.is_hidden ? "Да" : "Нет"}
- Причина скрытия: ${channel.hidden_reason || "Нет"}

Отчёты о нарушениях:
${reportsContext}

Последние сообщения в чате:
${messagesContext}

Действие запроса: ${action || "analyze"}

Возможные действия:
1. "approve" - Канал соответствует правилам, одобрить
2. "warn" - Канал имеет незначительные нарушения, предупредить владельца
3. "hide" - Серьёзные нарушения, скрыть канал
4. "unhide" - Канал ошибочно скрыт, восстановить
5. "no_action" - Недостаточно информации для решения

Проанализируйте контент и верните JSON в формате:
{
  "decision": "approve|warn|hide|unhide|no_action",
  "reason": "Краткое объяснение решения на русском языке",
  "confidence": 0.0-1.0,
  "details": "Подробное объяснение на русском"
}

Критерии для "hide":
- Нелегальный контент (пиратство с явными доказательствами)
- Контент для взрослых без маркировки
- Разжигание ненависти или насилие
- Многочисленные подтверждённые жалобы

Критерии для "warn":
- Подозрительный контент без явных нарушений
- Единичные жалобы без подтверждения

Критерии для "approve":
- Нет жалоб или все жалобы неподтверждённые
- Контент соответствует правилам`;

    // Call Lovable AI
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: "Вы — AI модератор платформы StreamLiveTV. Отвечайте только валидным JSON."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1000,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", errorText);
      throw new Error("AI moderation service unavailable");
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content || "";

    // Parse AI response
    let moderationResult;
    try {
      // Extract JSON from response (may have markdown code blocks)
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        moderationResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in AI response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", aiContent);
      moderationResult = {
        decision: "no_action",
        reason: "Не удалось обработать ответ AI",
        confidence: 0,
        details: aiContent,
      };
    }

    // Apply decision if action is "apply"
    if (action === "apply" && moderationResult.decision !== "no_action") {
      if (moderationResult.decision === "hide") {
        await supabase
          .from("channels")
          .update({
            is_hidden: true,
            hidden_at: new Date().toISOString(),
            hidden_reason: `AI модерация: ${moderationResult.reason}`,
          })
          .eq("id", channelId);
      } else if (moderationResult.decision === "unhide") {
        await supabase
          .from("channels")
          .update({
            is_hidden: false,
            hidden_at: null,
            hidden_reason: null,
          })
          .eq("id", channelId);
      }

      // Update pending appeals if any
      if (moderationResult.decision === "approve" || moderationResult.decision === "unhide") {
        await supabase
          .from("channel_appeals")
          .update({
            status: "approved",
            ai_decision: moderationResult.reason,
            resolved_at: new Date().toISOString(),
          })
          .eq("channel_id", channelId)
          .eq("status", "pending");
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        moderation: moderationResult,
        channel: {
          id: channel.id,
          title: channel.title,
          is_hidden: channel.is_hidden,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("AI moderation error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
