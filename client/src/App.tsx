import { Router as WouterRouter, Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Editor from "@/pages/Editor";
import NotFound from "@/pages/not-found";

function AppRoutes() {
    return (
        <Switch>
            <Route path="/" component={Editor} />
            <Route component={NotFound} />
        </Switch>
    );
}

export default function App() {
    // vite.config.ts -> base: "/3d/"
    const base = import.meta.env.BASE_URL.replace(/\/$/, ""); // "/3d"

    return (
        <QueryClientProvider client={queryClient}>
            <TooltipProvider>
                <Toaster />
                <WouterRouter base={base}>
                    <AppRoutes />
                </WouterRouter>
            </TooltipProvider>
        </QueryClientProvider>
    );
}
