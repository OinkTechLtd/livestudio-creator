import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelId: string;
  channelTitle: string;
}

const ReportDialog = ({ open, onOpenChange, channelId, channelTitle }: ReportDialogProps) => {
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
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

      const { error } = await supabase.from("reports").insert({
        channel_id: channelId,
        reporter_id: user.id,
        reason,
        description,
      });

      if (error) throw error;

      toast({
        title: "Жалоба отправлена",
        description: "Мы рассмотрим вашу жалобу в ближайшее время",
      });

      onOpenChange(false);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Пожаловаться на канал</DialogTitle>
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

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Отправка..." : "Отправить жалобу"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ReportDialog;
