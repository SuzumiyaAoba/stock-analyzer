import { createFileRoute, redirect } from "@tanstack/react-router";
import { dashboardSearchSchema } from "~/lib/dashboard-config";

export const Route = createFileRoute("/universe")({
  validateSearch: (search) => dashboardSearchSchema.parse(search),
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/",
      search: {
        ...search,
        view: "universe",
      },
      replace: true,
    });
  },
  component: () => null,
});
