import InternalProductionTabs from "@/components/InternalProductionTabs";

export default function InternalProductionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <InternalProductionTabs />
      {children}
    </>
  );
}
