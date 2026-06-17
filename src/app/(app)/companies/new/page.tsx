import { CompanyForm } from "@/components/companies/company-form";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";

export default async function NewCompanyPage() {
  const session = await auth();

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Add Company</CardTitle>
          <CardDescription>Create a group company for shared-services project and IT tracking.</CardDescription>
        </CardHeader>
      </Card>
      {session?.user.role === "ADMIN" && <CompanyForm />}
    </div>
  );
}
