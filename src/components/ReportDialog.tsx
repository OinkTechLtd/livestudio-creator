import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, CheckCircle2, Loader2, ShieldAlert } from "lucide-react";

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelId: string;
  channelTitle: string;
}

interface ModerationResult {
  decision: "approve" | "reject" | "warn" | "hide" | "unhide";
  confidence: number;
  reasoning: string;
  recommendations: string[];
}

const ReportDialog = ({ open, onOpenChange, channelId, channelTitle }: ReportDialogProps) => {
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [moderationResult, setModerationResult] = useState<ModerationResult | null>(null);
  const [showResult, setShowResult] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!reason) {
      toast({
        title: "Ошибка",
        description: "Пожалуйста, выберите причину жалобы",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    setModerationResult(null);
    setShowResult(false);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Ошибка",
          description: "Вы должны войти в систему",
          variant: "destructive",
        });
        return;
      }

      // Save the report first
      const { error: reportError } = await supabase.from("reports").insert({
        channel_id: channelId,
        reporter_id: user.id,
        reason,
        description,
        is_verified: false,
        status: "pending",
      });

      if (reportError) throw reportError;

      // Call AI moderation with apply action
      const { data: moderationData, error: moderationError } = await supabase.functions.invoke(
        "ai-moderate-channel",
        {
          body: { 
            channelId, 
            action: "apply" // Auto-apply the decision
          },
        }
      );

      if (moderationError) {
        console.error("AI moderation error:", moderationError);
        toast({
          title: "Жалоба отправлена",
          description: "Жалоба сохранена, но AI-модерация временно недоступна",
        });
        onOpenChange(false);
        return;
      }

      // Show moderation result
      if (moderationData?.moderation) {
        setModerationResult(moderationData.moderation);
        setShowResult(true);

        // Update report status based on AI decision
        const isApproved = moderationData.moderation.decision === "hide" || 
                          moderationData.moderation.decision === "approve";
        
        await supabase.from("reports")
          .update({ 
            is_verified: isApproved,
            verified_at: isApproved ? new Date().toISOString() : null,
            status: isApproved ? "approved" : "rejected",
          })
          .eq("channel_id", channelId)
          .eq("reporter_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1);

        // Notify user about the result
        if (moderationData.moderation.decision === "hide") {
          await supabase.from("notifications").insert({
            user_id: user.id,
            channel_id: channelId,
            type: "report_resolved",
            title: "Жалоба подтверждена",
            message: `Канал "${channelTitle}" был скрыт после проверки AI. Спасибо за помощь!`,
          });
        }
      } else {
        toast({
          title: "Жалоба отправлена",
          description: "Ваша жалоба будет рассмотрена модераторами",
        });
        onOpenChange(false);
      }

      setReason("");
      setDescription("");
    } catch (error) {
      console.error("Error submitting report:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось отправить жалобу",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setShowResult(false);
    setModerationResult(null);
    onOpenChange(false);
  };

  const getDecisionIcon = (decision: string) => {
    switch (decision) {
      case "hide":
      case "approve":
        return <CheckCircle2 className="w-12 h-12 text-green-500" />;
      case "reject":
        return <AlertCircle className="w-12 h-12 text-yellow-500" />;
      default:
        return <ShieldAlert className="w-12 h-12 text-primary" />;
    }
  };

  const getDecisionText = (decision: string) => {
    switch (decision) {
      case "hide":
        return "Канал скрыт";
      case "approve":
        return "Нарушение подтверждено";
      case "reject":
        return "Нарушение не обнаружено";
      case "warn":
        return "Выдано предупреждение";
      default:
        return "Решение принято";
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        {showResult && moderationResult ? (
          <div className="text-center py-4">
            <div className="mb-4 flex justify-center">
              {getDecisionIcon(moderationResult.decision)}
            </div>
            <h3 className="text-xl font-semibold mb-2">
              {getDecisionText(moderationResult.decision)}
            </h3>
            <p className="text-muted-foreground mb-4">
              {moderationResult.reasoning}
            </p>
            <div className="bg-muted rounded-lg p-3 mb-4 text-left">
              <p className="text-sm font-medium mb-2">Уверенность AI: {Math.round(moderationResult.confidence * 100)}%</p>
              {moderationResult.recommendations.length > 0 && (
                <>
                  <p className="text-sm font-medium mb-1">Рекомендации:</p>
                  <ul className="text-sm text-muted-foreground list-disc list-inside">
                    {moderationResult.recommendations.map((rec, i) => (
                      <li key={i}>{rec}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
            <Button onClick={handleClose} className="w-full">
              Закрыть
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5" />
                Пожаловаться на канал
              </DialogTitle>
              <DialogDescription>
                Канал: {channelTitle}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-3">
                <Label>Причина жалобы</Label>
                <RadioGroup value={reason} onValueChange={setReason}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="spam" id="spam" />
                    <Label htmlFor="spam" className="font-normal cursor-pointer">Спам или вводящий в заблуждение контент</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="inappropriate" id="inappropriate" />
                    <Label htmlFor="inappropriate" className="font-normal cursor-pointer">Неприемлемый контент</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="copyright" id="copyright" />
                    <Label htmlFor="copyright" className="font-normal cursor-pointer">Нарушение авторских прав</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="violence" id="violence" />
                    <Label htmlFor="violence" className="font-normal cursor-pointer">Насилие или опасный контент</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="other" id="other" />
                    <Label htmlFor="other" className="font-normal cursor-pointer">Другое</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Дополнительная информация (необязательно)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Опишите проблему подробнее..."
                  rows={4}
                />
              </div>

              <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
                <p className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4" />
                  Жалоба будет автоматически проверена AI-модератором
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
                  Отмена
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Проверка AI...
                    </>
                  ) : (
                    "Отправить жалобу"
                  )}
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ReportDialog;
