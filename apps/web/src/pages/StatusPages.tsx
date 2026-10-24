import { Link } from "react-router-dom";
import { Compass, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/States";

export function ForbiddenPage() {
  return (
    <EmptyState
      icon={<ShieldAlert />}
      title="You don't have access to this page"
      description="Your current role does not include this module. Switch role using the Demo Role selector in the top bar."
      action={<Button asChild variant="outline"><Link to="/">Back to dashboard</Link></Button>}
    />
  );
}

export function NotFoundPage() {
  return (
    <EmptyState
      icon={<Compass />}
      title="Page not found"
      description="The page or record you are looking for does not exist or was removed."
      action={<Button asChild variant="outline"><Link to="/">Back to dashboard</Link></Button>}
    />
  );
}
