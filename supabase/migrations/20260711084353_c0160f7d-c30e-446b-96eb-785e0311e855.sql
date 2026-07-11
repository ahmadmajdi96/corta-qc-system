
ALTER TABLE public.inspections ADD CONSTRAINT inspections_performed_by_profile_fkey FOREIGN KEY (performed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.inspection_schedules ADD CONSTRAINT inspection_schedules_assigned_to_profile_fkey FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.inspection_measurements ADD CONSTRAINT inspection_measurements_recorded_by_profile_fkey FOREIGN KEY (recorded_by) REFERENCES public.profiles(id);
ALTER TABLE public.non_conformances ADD CONSTRAINT non_conformances_raised_by_profile_fkey FOREIGN KEY (raised_by) REFERENCES public.profiles(id);
ALTER TABLE public.corrective_actions ADD CONSTRAINT corrective_actions_assigned_to_profile_fkey FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.corrective_actions ADD CONSTRAINT corrective_actions_verified_by_profile_fkey FOREIGN KEY (verified_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.quality_specifications ADD CONSTRAINT quality_specifications_created_by_profile_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_user_profile_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
