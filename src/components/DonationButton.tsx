import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DonationButtonProps {
  donationUrl: string;
}

const DonationButton = ({ donationUrl }: DonationButtonProps) => {
  if (!donationUrl) return null;

  return (
    <Button
      variant="outline"
      className="bg-gradient-to-r from-pink-500/10 to-red-500/10 border-pink-500/30 hover:border-pink-500/50 text-pink-600 dark:text-pink-400"
      onClick={() => window.open(donationUrl, "_blank")}
    >
      <Heart className="w-4 h-4 mr-2 fill-current" />
      Поддержать
    </Button>
  );
};

export default DonationButton;
