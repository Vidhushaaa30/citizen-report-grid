-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('USER', 'MODERATOR');

-- Create enum for report categories
CREATE TYPE public.report_category AS ENUM ('power_outage', 'water_cut', 'road_damage', 'other');

-- Create enum for report status
CREATE TYPE public.report_status AS ENUM ('pending', 'verified', 'rejected');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'USER',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create reports table
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category report_category NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT,
  location TEXT,
  status report_status DEFAULT 'pending' NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS on reports
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_roles table
CREATE POLICY "Users can view their own roles"
  ON public.user_roles
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own role on signup"
  ON public.user_roles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id AND role = 'USER');

-- RLS policies for reports table
CREATE POLICY "Anyone can view verified reports"
  ON public.reports
  FOR SELECT
  USING (status = 'verified' OR auth.uid() = user_id OR public.has_role(auth.uid(), 'MODERATOR'));

CREATE POLICY "Users can create reports"
  ON public.reports
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pending reports"
  ON public.reports
  FOR UPDATE
  USING (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Moderators can update any report"
  ON public.reports
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'MODERATOR'));

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for reports updated_at
CREATE TRIGGER update_reports_updated_at
  BEFORE UPDATE ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to auto-assign USER role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'USER');
  RETURN NEW;
END;
$$;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Create storage bucket for report images
INSERT INTO storage.buckets (id, name, public)
VALUES ('report-images', 'report-images', true);

-- Storage policies for report images
CREATE POLICY "Anyone can view report images"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'report-images');

CREATE POLICY "Authenticated users can upload report images"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'report-images' AND auth.uid() IS NOT NULL);

-- Create seeded moderator account (email: moderator@example.com, password: password123)
-- Note: This will be created via auth.users which requires Supabase admin access
-- The password hash for 'password123' will need to be set manually or via signup