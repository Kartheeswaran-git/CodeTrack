-- Update existing user to admin
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'kartheeswaran2201@gmail.com';

-- Update trigger function to assign admin role to the first user or specific admin email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  is_first_user BOOLEAN;
BEGIN
  SELECT NOT EXISTS (SELECT 1 FROM public.profiles) INTO is_first_user;

  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'name', 'New User'),
    CASE 
      WHEN is_first_user OR new.email = 'kartheeswaran2201@gmail.com' THEN 'admin'::user_role 
      ELSE 'student'::user_role 
    END
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
