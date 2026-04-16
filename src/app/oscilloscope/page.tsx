
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { XCircle } from "lucide-react";

export default function FeatureRemovedPage() {
  return (
    <div className="flex items-center justify-center h-[calc(100vh-theme(spacing.28))]">
        <Card className="w-full max-w-md text-center">
            <CardHeader>
                <div className="mx-auto bg-destructive/10 rounded-full p-3 w-fit">
                    <XCircle className="w-12 h-12 text-destructive"/>
                </div>
                <CardTitle className="mt-4">功能已移除</CardTitle>
                <CardDescription>
                    示波器功能已被移除。
                </CardDescription>
            </CardHeader>
        </Card>
    </div>
  );
}
