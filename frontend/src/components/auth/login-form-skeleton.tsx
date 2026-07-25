import {
    Card,
    CardContent,
    CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function LoginFormSkeleton() {
    return (
        <Card className="w-full max-w-md border-none px-10 py-14 shadow">
            <CardHeader className="mb-8 items-center px-0 text-center">
                {/* Title */}
                <Skeleton className="h-9 w-52 rounded-lg" />

                {/* Description */}
                <div className="mt-4 space-y-2">
                    <Skeleton className="mx-auto h-4 w-72 rounded-md" />
                    <Skeleton className="mx-auto h-4 w-56 rounded-md" />
                </div>
            </CardHeader>

            <CardContent className="px-0">
                <div className="space-y-8">
                    {/* Email */}
                    <div className="space-y-3">
                        <Skeleton className="h-4 w-28 rounded-md" />
                        <Skeleton className="h-12 w-full rounded-xl" />
                    </div>

                    {/* Password */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Skeleton className="h-4 w-20 rounded-md" />
                            <Skeleton className="h-4 w-32 rounded-md" />
                        </div>

                        <Skeleton className="h-12 w-full rounded-xl" />
                    </div>

                    {/* Remember Me */}
                    <div className="flex items-center gap-3">
                        <Skeleton className="h-5 w-5 rounded-md" />
                        <Skeleton className="h-4 w-28 rounded-md" />
                    </div>

                    {/* Button */}
                    <Skeleton className="h-12 w-full rounded-xl" />

                    {/* Footer */}
                    <div className="flex justify-center gap-2 pt-4">
                        <Skeleton className="h-4 w-36 rounded-md" />
                        <Skeleton className="h-4 w-16 rounded-md" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}