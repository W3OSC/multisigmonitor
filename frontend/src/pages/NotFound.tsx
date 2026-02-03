import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="flex items-center justify-center min-h-screen w-full p-8">
      <div className="max-w-2xl mx-auto px-4 text-center">
        <div className="relative inline-block mb-8">
          <div className="absolute inset-0 animate-pulse bg-primary/20 blur-3xl rounded-full"></div>
          <ShieldAlert className="relative w-32 h-32 text-primary animate-bounce" />
        </div>

        <h1 className="text-8xl font-bold mb-4 bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
          404
        </h1>

        <h2 className="text-3xl font-semibold mb-4">
          Security Checkpoint Not Found
        </h2>

        <p className="text-muted-foreground mb-8 text-lg">
          The page you're looking for has been moved to a more secure location or never existed.
        </p>

        <Button
          onClick={() => navigate(-1)}
          variant="default"
          size="lg"
          className="group"
        >
          <ArrowLeft className="mr-2 h-5 w-5 group-hover:-translate-x-1 transition-transform" />
          Go Back
        </Button>

        <p className="mt-8 text-sm text-muted-foreground">
          Lost route: <code className="bg-muted px-2 py-1 rounded text-xs">{location.pathname}</code>
        </p>
      </div>

      <style>
        {`
          @keyframes float {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-20px) rotate(180deg); }
          }
          
          @keyframes gradient {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
          }
          
          .animate-gradient {
            background-size: 200% 200%;
            animation: gradient 3s ease infinite;
          }
        `}
      </style>
    </div>
  );
};

export default NotFound;
