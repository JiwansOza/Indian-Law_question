import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Copy, Scale } from "lucide-react";

const GEMINI_API_KEY = "AIzaSyD3fr9PEgxZyC4muVphMt5n9qtyvq77Hlc";

const TOPICS = [
  { value: "child-abuse", label: "Child Abuse" },
  { value: "women-harassment", label: "Women Harassment" },
  { value: "pocso", label: "POCSO (Protection of Children from Sexual Offences Act, 2012)" },
];

const Index = () => {
  const [selectedTopic, setSelectedTopic] = useState<string>("");
  const [questions, setQuestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const generateQuestions = async () => {
    if (!selectedTopic) {
      toast.error("Please select a topic");
      return;
    }

    setLoading(true);
    setQuestions([]);

    const topicContext = {
      "child-abuse": "Child Abuse under Indian Penal Code (IPC) and child protection laws",
      "women-harassment": "Women Harassment under IPC Sections 354A-354D and Sexual Harassment of Women at Workplace Act, 2013",
      "pocso": "Protection of Children from Sexual Offences Act (POCSO), 2012"
    };

    const systemPrompt = `You are an AI Question Generator specialized in Indian Law.

Generate 5 diverse, factually correct, and exam-level questions based ONLY on Indian law for the topic: ${topicContext[selectedTopic as keyof typeof topicContext]}.

Rules:
1. All questions must be related ONLY to Indian legal context
2. Do NOT mention or refer to international or foreign laws
3. Each question must be grammatically correct, factually accurate, and clearly written
4. Focus on relevant Indian legal provisions and acts
5. Self-check each question for factual accuracy

Return ONLY a JSON object in this exact format:
{
  "questions": [
    "Question 1...",
    "Question 2...",
    "Question 3...",
    "Question 4...",
    "Question 5..."
  ]
}`;

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: systemPrompt
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("API Error:", errorData);
        throw new Error(errorData.error?.message || "Failed to generate questions");
      }

      const data = await response.json();
      console.log("API Response:", data);
      const generatedText = data.candidates[0]?.content?.parts[0]?.text;
      
      if (!generatedText) {
        throw new Error("No response from AI");
      }

      // Extract JSON from response
      const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error("Generated text:", generatedText);
        throw new Error("Invalid response format");
      }

      const parsedData = JSON.parse(jsonMatch[0]);
      
      if (!parsedData.questions || !Array.isArray(parsedData.questions) || parsedData.questions.length === 0) {
        throw new Error("Invalid questions format");
      }

      setQuestions(parsedData.questions);
      toast.success("Questions generated successfully!");
    } catch (error) {
      console.error("Error generating questions:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Unable to generate questions: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const copyAllQuestions = () => {
    const text = questions.map((q, i) => `${i + 1}. ${q}`).join("\n\n");
    navigator.clipboard.writeText(text);
    toast.success("Questions copied to clipboard!");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12 animate-fade-in">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Scale className="w-12 h-12 text-primary" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-3">
            Indian Law Question Generator
          </h1>
          <p className="text-lg text-muted-foreground">
            Generate topic-based questions related only to Indian legal systems
          </p>
        </div>

        {/* Topic Selection */}
        <Card className="p-8 mb-8 animate-fade-in" style={{ animationDelay: "0.2s" }}>
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-semibold mb-3">
                Select Topic
              </h3>
              <Select value={selectedTopic} onValueChange={setSelectedTopic}>
                <SelectTrigger id="topic" className="w-full">
                  <SelectValue placeholder="Choose a legal topic" />
                </SelectTrigger>
                <SelectContent>
                  {TOPICS.map((topic) => (
                    <SelectItem key={topic.value} value={topic.value}>
                      {topic.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={generateQuestions}
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Generating Questions...
                </>
              ) : (
                "Generate Questions"
              )}
            </Button>
          </div>
        </Card>

        {/* Results */}
        {questions.length > 0 && (
          <Card className="p-8 animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-foreground">Generated Questions</h2>
              <Button onClick={copyAllQuestions} variant="outline" size="sm">
                <Copy className="mr-2 h-4 w-4" />
                Copy All
              </Button>
            </div>
            <div className="space-y-4">
              {questions.map((question, index) => (
                <div
                  key={index}
                  className="p-4 rounded-lg bg-muted/50 border border-border hover:border-primary/50 transition-colors"
                >
                  <p className="text-foreground">
                    <span className="font-semibold text-primary mr-2">{index + 1}.</span>
                    {question}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* About Section */}
        <div className="mt-12 text-center text-sm text-muted-foreground animate-fade-in" style={{ animationDelay: "0.3s" }}>
         
        </div>
      </div>
    </div>
  );
};

export default Index;
