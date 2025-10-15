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

interface MCQQuestion {
  question: string;
  options: string[];
  correctAnswer: number; // Index of correct answer (0-3)
}

const Index = () => {
  const [selectedTopic, setSelectedTopic] = useState<string>("");
  const [questions, setQuestions] = useState<MCQQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState<{ [key: number]: number }>({});

  const generateQuestions = async (retryCount = 0) => {
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

    const systemPrompt = `Generate 5 MCQ questions about Indian law topic: ${topicContext[selectedTopic as keyof typeof topicContext]}.

CRITICAL RULES:
1. ONLY Indian legal context - NO international/foreign laws
2. Factually accurate and exam-level questions
3. Focus on relevant Indian legal provisions and acts
4. 4 options per question (A,B,C,D), only 1 correct
5. Return ONLY valid JSON format

Return ONLY this JSON (no extra text):
{
  "questions": [
    {
      "question": "Question?",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": 0
    }
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
            maxOutputTokens: 4096,
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

      // Extract JSON from response - try multiple approaches
      let jsonText = generatedText.trim();
      
      // Remove any markdown code blocks
      jsonText = jsonText.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      
      // Try to find JSON object - handle incomplete responses
      let jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      
      // If no complete JSON found, try to find incomplete JSON and fix it
      if (!jsonMatch) {
        // Look for partial JSON starting with {
        const partialMatch = jsonText.match(/\{[\s\S]*$/);
        if (partialMatch) {
          console.warn("Incomplete JSON detected, attempting to fix...");
          let incompleteJson = partialMatch[0];
          
          // Try to complete the JSON by finding the last complete object/array
          let braceCount = 0;
          let bracketCount = 0;
          let inString = false;
          let lastCompletePos = -1;
          
          for (let i = 0; i < incompleteJson.length; i++) {
            const char = incompleteJson[i];
            const prevChar = i > 0 ? incompleteJson[i - 1] : '';
            
            if (char === '"' && prevChar !== '\\') {
              inString = !inString;
            }
            
            if (!inString) {
              if (char === '{') braceCount++;
              else if (char === '}') braceCount--;
              else if (char === '[') bracketCount++;
              else if (char === ']') bracketCount--;
              
              // If we're back to balanced braces/brackets, this might be a complete position
              if (braceCount === 0 && bracketCount === 0) {
                lastCompletePos = i;
              }
            }
          }
          
          if (lastCompletePos > 0) {
            // Truncate to the last complete position
            incompleteJson = incompleteJson.substring(0, lastCompletePos + 1);
            jsonMatch = [incompleteJson];
          }
        }
      }
      
      if (!jsonMatch) {
        console.error("Generated text:", generatedText);
        throw new Error("No valid JSON object found in response - the AI response may be incomplete");
      }

      let parsedData;
      try {
        parsedData = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        console.error("JSON Parse Error:", parseError);
        console.error("Attempted to parse:", jsonMatch[0]);
        
        // Try to fix common JSON issues
        const fixedJson = jsonMatch[0]
          .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
          .replace(/([{,]\s*)(\w+):/g, '$1"$2":') // Quote unquoted keys
          .replace(/:\s*'([^']*)'/g, ': "$1"') // Replace single quotes with double quotes
          .replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":') // Quote property names
          .replace(/:\s*([^",{[}\s][^",}\]]*?)(\s*[,}\]])/g, ': "$1"$2'); // Quote unquoted string values
        
        try {
          parsedData = JSON.parse(fixedJson);
        } catch (secondError) {
          console.error("Second parse attempt failed:", secondError);
          throw new Error(`Invalid JSON format: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
        }
      }
      
      if (!parsedData.questions || !Array.isArray(parsedData.questions) || parsedData.questions.length === 0) {
        throw new Error("Invalid questions format");
      }

      // Validate MCQ format
      const validQuestions = parsedData.questions.filter((q: unknown): q is MCQQuestion => {
        const question = q as MCQQuestion;
        return question.question && question.options && Array.isArray(question.options) && question.options.length === 4 && 
          typeof question.correctAnswer === 'number' && question.correctAnswer >= 0 && question.correctAnswer <= 3;
      });

      if (validQuestions.length === 0) {
        throw new Error("No valid MCQ questions found");
      }

      setQuestions(validQuestions);
      setSelectedAnswers({}); // Reset selected answers
      toast.success(`Generated ${validQuestions.length} MCQ questions successfully!`);
    } catch (error) {
      console.error("Error generating questions:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      
      // Retry up to 2 times for JSON parsing errors
      if (retryCount < 2 && (errorMessage.includes("JSON") || errorMessage.includes("incomplete"))) {
        console.log(`Retrying... (attempt ${retryCount + 1})`);
        toast.info(`Retrying generation... (attempt ${retryCount + 1}/2)`);
        setTimeout(() => {
          generateQuestions(retryCount + 1);
        }, 1000);
        return;
      }
      
      toast.error(`Unable to generate questions: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const copyAllQuestions = () => {
    const text = questions.map((q, i) => {
      let questionText = `${i + 1}. ${q.question}\n`;
      q.options.forEach((option, index) => {
        const letter = String.fromCharCode(65 + index); // A, B, C, D
        questionText += `   ${letter}. ${option}\n`;
      });
      questionText += `   Correct Answer: ${String.fromCharCode(65 + q.correctAnswer)}\n`;
      return questionText;
    }).join("\n\n");
    navigator.clipboard.writeText(text);
    toast.success("Questions copied to clipboard!");
  };

  const handleOptionClick = (questionIndex: number, optionIndex: number) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [questionIndex]: optionIndex
    }));
  };

  const getOptionStyle = (questionIndex: number, optionIndex: number) => {
    const selectedAnswer = selectedAnswers[questionIndex];
    const question = questions[questionIndex];
    
    if (selectedAnswer === undefined) {
      return "hover:bg-primary/10 cursor-pointer focus:ring-2 focus:ring-primary/20";
    }
    
    if (selectedAnswer === optionIndex) {
      if (optionIndex === question.correctAnswer) {
        return "bg-green-100 border-green-500 text-green-700";
      } else {
        return "bg-red-100 border-red-500 text-red-700";
      }
    } else if (optionIndex === question.correctAnswer) {
      return "bg-green-100 border-green-500 text-green-700";
    }
    
    return "opacity-50 cursor-not-allowed";
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
              onClick={() => generateQuestions()}
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
              <h2 className="text-2xl font-bold text-foreground">Generated MCQ Questions</h2>
              <Button onClick={copyAllQuestions} variant="outline" size="sm">
                <Copy className="mr-2 h-4 w-4" />
                Copy All
              </Button>
            </div>
            <div className="space-y-6">
              {questions.map((question, questionIndex) => (
                <div
                  key={`question-${questionIndex}`}
                  className="p-6 rounded-lg bg-muted/50 border border-border hover:border-primary/50 transition-colors"
                >
                  <p className="text-foreground mb-4 font-medium">
                    <span className="font-semibold text-primary mr-2">{questionIndex + 1}.</span>
                    {question.question}
                  </p>
                  <div className="space-y-2">
                    {question.options.map((option, optionIndex) => (
                      <button
                        key={`${questionIndex}-${optionIndex}`}
                        onClick={() => handleOptionClick(questionIndex, optionIndex)}
                        disabled={selectedAnswers[questionIndex] !== undefined}
                        aria-label={`Select option ${String.fromCharCode(65 + optionIndex)}`}
                        className={`w-full text-left p-3 rounded-lg border transition-all ${getOptionStyle(questionIndex, optionIndex)}`}
                      >
                        <span className="font-medium mr-3">
                          {String.fromCharCode(65 + optionIndex)}.
                        </span>
                        {option}
                      </button>
                    ))}
                  </div>
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
