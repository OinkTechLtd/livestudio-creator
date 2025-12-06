import { useEffect, useState } from "react";

// Get current season based on month
const getSeason = () => {
  const month = new Date().getMonth() + 1; // 1-12
  
  // Winter: December - March (snow)
  if (month >= 12 || month <= 3) return "winter";
  // Spring/Summer: April - September  
  if (month >= 4 && month <= 9) return "summer";
  // Autumn: October - November
  return "autumn";
};

const SeasonalEffects = () => {
  const [season, setSeason] = useState(getSeason());
  const [particles, setParticles] = useState<{ id: number; x: number; delay: number; duration: number; size: number }[]>([]);

  useEffect(() => {
    setSeason(getSeason());
    
    // Generate particles
    const newParticles = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 5,
      duration: 5 + Math.random() * 10,
      size: season === "winter" ? 4 + Math.random() * 8 : 6 + Math.random() * 12,
    }));
    setParticles(newParticles);
  }, []);

  if (season === "winter") {
    return (
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        {particles.map((particle) => (
          <div
            key={particle.id}
            className="absolute text-white opacity-80 animate-fall"
            style={{
              left: `${particle.x}%`,
              animationDelay: `${particle.delay}s`,
              animationDuration: `${particle.duration}s`,
              fontSize: `${particle.size}px`,
            }}
          >
            ❄
          </div>
        ))}
        <style>{`
          @keyframes fall {
            0% {
              transform: translateY(-10vh) rotate(0deg);
              opacity: 1;
            }
            100% {
              transform: translateY(110vh) rotate(360deg);
              opacity: 0.3;
            }
          }
          .animate-fall {
            animation: fall linear infinite;
          }
        `}</style>
      </div>
    );
  }

  if (season === "summer") {
    return (
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        {particles.slice(0, 20).map((particle) => (
          <div
            key={particle.id}
            className="absolute opacity-60 animate-float"
            style={{
              left: `${particle.x}%`,
              bottom: `${Math.random() * 30}%`,
              animationDelay: `${particle.delay}s`,
              animationDuration: `${particle.duration + 5}s`,
              fontSize: `${particle.size}px`,
            }}
          >
            {Math.random() > 0.5 ? "🌸" : "🍃"}
          </div>
        ))}
        <style>{`
          @keyframes float {
            0%, 100% {
              transform: translateY(0) translateX(0) rotate(0deg);
              opacity: 0.6;
            }
            25% {
              transform: translateY(-20px) translateX(10px) rotate(45deg);
            }
            50% {
              transform: translateY(-10px) translateX(-10px) rotate(90deg);
              opacity: 0.8;
            }
            75% {
              transform: translateY(-30px) translateX(15px) rotate(135deg);
            }
          }
          .animate-float {
            animation: float ease-in-out infinite;
          }
        `}</style>
      </div>
    );
  }

  if (season === "autumn") {
    return (
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        {particles.slice(0, 30).map((particle) => (
          <div
            key={particle.id}
            className="absolute animate-fall-leaf"
            style={{
              left: `${particle.x}%`,
              animationDelay: `${particle.delay}s`,
              animationDuration: `${particle.duration + 3}s`,
              fontSize: `${particle.size}px`,
            }}
          >
            {["🍂", "🍁", "🍃"][Math.floor(Math.random() * 3)]}
          </div>
        ))}
        <style>{`
          @keyframes fall-leaf {
            0% {
              transform: translateY(-10vh) translateX(0) rotate(0deg);
              opacity: 0.9;
            }
            25% {
              transform: translateY(25vh) translateX(30px) rotate(90deg);
            }
            50% {
              transform: translateY(50vh) translateX(-20px) rotate(180deg);
            }
            75% {
              transform: translateY(75vh) translateX(40px) rotate(270deg);
            }
            100% {
              transform: translateY(110vh) translateX(0) rotate(360deg);
              opacity: 0.3;
            }
          }
          .animate-fall-leaf {
            animation: fall-leaf linear infinite;
          }
        `}</style>
      </div>
    );
  }

  return null;
};

export default SeasonalEffects;
