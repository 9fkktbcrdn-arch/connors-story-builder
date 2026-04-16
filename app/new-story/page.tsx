import { StoryWizard } from "@/components/StoryWizard/StoryWizard";

export const metadata = {
  title: "New story · Connor's Story Builder",
};

export default function NewStoryPage() {
  return (
    <div className="min-h-dvh">
      <StoryWizard />
    </div>
  );
}
