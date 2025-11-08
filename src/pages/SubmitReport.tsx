import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { z } from "zod";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const reportSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200, "Title must be less than 200 characters"),
  category: z.enum(["power_outage", "water_cut", "road_damage", "other"], {
    required_error: "Category is required",
  }),
  description: z.string().trim().min(1, "Description is required").max(2000, "Description must be less than 2000 characters"),
  location: z.string().trim().max(500, "Location must be less than 500 characters").optional(),
});

export default function SubmitReport() {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);

    try {
      // Validate inputs
      const validationResult = reportSchema.safeParse({
        title,
        category,
        description,
        location: location || undefined,
      });

      if (!validationResult.success) {
        const firstError = validationResult.error.errors[0];
        toast({
          title: "Validation failed",
          description: firstError.message,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Validate file size
      if (image && image.size > MAX_FILE_SIZE) {
        toast({
          title: "Validation failed",
          description: "Image must be less than 5MB",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      let imageUrl = null;

      if (image) {
        const fileExt = image.name.split(".").pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("report-images")
          .upload(fileName, image);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("report-images")
          .getPublicUrl(fileName);

        imageUrl = publicUrl;
      }

      const { error } = await supabase.from("reports").insert({
        title: validationResult.data.title,
        category: validationResult.data.category,
        description: validationResult.data.description,
        location: validationResult.data.location || null,
        image_url: imageUrl,
        user_id: user.id,
      });

      if (error) throw error;

      toast({
        title: "Report submitted",
        description: "Your report has been submitted successfully.",
      });
      navigate("/dashboard");
    } catch (error: any) {
      toast({
        title: "Submission failed",
        description: "Failed to submit report. Please try again.",
        variant: "destructive",
      });
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto max-w-2xl p-6">
        <Card>
          <CardHeader>
            <CardTitle>Submit a Report</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={category} onValueChange={setCategory} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="power_outage">Power Outage</SelectItem>
                    <SelectItem value="water_cut">Water Cut</SelectItem>
                    <SelectItem value="road_damage">Road Damage</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={2000}
                  rows={4}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location (optional)</Label>
                <Input
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  maxLength={500}
                  placeholder="e.g., Main Street, near the park"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="image">Image (optional)</Label>
                <Input
                  id="image"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImage(e.target.files?.[0] || null)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Submitting..." : "Submit Report"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
