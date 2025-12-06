import { Github } from "lucide-react";
import { Button } from "@/components/ui/button";

const GitHubLink = () => {
  return (
    <a
      href="https://github.com/OinkTechLtd/livestudio-creator"
      target="_blank"
      rel="noopener noreferrer"
    >
      <Button variant="ghost" size="sm" className="gap-2">
        <Github className="w-4 h-4" />
        <span className="hidden md:inline">GitHub</span>
      </Button>
    </a>
  );
};

export default GitHubLink;
