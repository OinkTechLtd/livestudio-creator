import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Smile } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ChatEmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
}

// Twitch-style emojis organized by category
const emojiCategories = {
  faces: [
    "😀", "😃", "😄", "😁", "😅", "😂", "🤣", "😊", "😇", "🙂", 
    "😉", "😍", "🥰", "😘", "😋", "😛", "😜", "🤪", "😎", "🤩",
    "😏", "😒", "🙄", "😬", "😮", "😯", "😲", "😱", "😨", "😰",
    "😢", "😭", "😤", "😠", "😡", "🤬", "😈", "👿", "💀", "☠️"
  ],
  gestures: [
    "👍", "👎", "👊", "✊", "🤛", "🤜", "👏", "🙌", "👐", "🤝",
    "🤲", "🙏", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆",
    "👇", "☝️", "👋", "🤚", "🖐️", "✋", "🖖", "💪", "🦾", "🫶"
  ],
  reactions: [
    "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💯", "💢",
    "💥", "💫", "💦", "💨", "🔥", "⭐", "🌟", "✨", "💎", "💰",
    "🎉", "🎊", "🎁", "🏆", "🥇", "🎵", "🎶", "🔔", "📢", "💬"
  ],
  twitch: [
    "Kappa", "PogChamp", "LUL", "Kreygasm", "ResidentSleeper",
    "BibleThump", "TriHard", "EleGiggle", "DansGame", "4Head",
    "Jebaited", "MonkaS", "OMEGALUL", "PepeHands", "FeelsBadMan",
    "FeelsGoodMan", "Pepega", "WeirdChamp", "KEKW", "Sadge"
  ]
};

// Custom Twitch-style emote images (using emoji fallbacks)
const twitchEmotes: Record<string, string> = {
  "Kappa": "😏",
  "PogChamp": "😲",
  "LUL": "😂",
  "Kreygasm": "😫",
  "ResidentSleeper": "😴",
  "BibleThump": "😢",
  "TriHard": "😤",
  "EleGiggle": "🤭",
  "DansGame": "😖",
  "4Head": "😃",
  "Jebaited": "😜",
  "MonkaS": "😰",
  "OMEGALUL": "🤣",
  "PepeHands": "😿",
  "FeelsBadMan": "😞",
  "FeelsGoodMan": "😊",
  "Pepega": "🤪",
  "WeirdChamp": "🤨",
  "KEKW": "😆",
  "Sadge": "😔"
};

const ChatEmojiPicker = ({ onEmojiSelect }: ChatEmojiPickerProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (emoji: string) => {
    // Check if it's a Twitch emote name
    const actualEmoji = twitchEmotes[emoji] || emoji;
    onEmojiSelect(actualEmoji);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 shrink-0"
          type="button"
        >
          <Smile className="w-5 h-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-80 p-2" 
        side="top" 
        align="end"
      >
        <Tabs defaultValue="faces" className="w-full">
          <TabsList className="w-full grid grid-cols-4 h-8">
            <TabsTrigger value="faces" className="text-xs">😀</TabsTrigger>
            <TabsTrigger value="gestures" className="text-xs">👍</TabsTrigger>
            <TabsTrigger value="reactions" className="text-xs">❤️</TabsTrigger>
            <TabsTrigger value="twitch" className="text-xs">🎮</TabsTrigger>
          </TabsList>

          <TabsContent value="faces" className="mt-2">
            <div className="grid grid-cols-8 gap-1 max-h-40 overflow-y-auto">
              {emojiCategories.faces.map((emoji, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelect(emoji)}
                  className="w-8 h-8 flex items-center justify-center text-lg hover:bg-muted rounded transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="gestures" className="mt-2">
            <div className="grid grid-cols-8 gap-1 max-h-40 overflow-y-auto">
              {emojiCategories.gestures.map((emoji, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelect(emoji)}
                  className="w-8 h-8 flex items-center justify-center text-lg hover:bg-muted rounded transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="reactions" className="mt-2">
            <div className="grid grid-cols-8 gap-1 max-h-40 overflow-y-auto">
              {emojiCategories.reactions.map((emoji, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelect(emoji)}
                  className="w-8 h-8 flex items-center justify-center text-lg hover:bg-muted rounded transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="twitch" className="mt-2">
            <div className="grid grid-cols-4 gap-1 max-h-40 overflow-y-auto">
              {emojiCategories.twitch.map((emote, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelect(emote)}
                  className="flex items-center justify-center gap-1 px-2 py-1 text-xs hover:bg-muted rounded transition-colors"
                >
                  <span className="text-base">{twitchEmotes[emote]}</span>
                  <span className="text-[10px] text-muted-foreground truncate">{emote}</span>
                </button>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
};

export default ChatEmojiPicker;