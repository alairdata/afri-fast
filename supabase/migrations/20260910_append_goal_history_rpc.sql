-- recordGoalChange (FastingApp.jsx) used to build the new goal_history array from this
-- component's own local React state and push the whole array back as an upsert patch. That's
-- unsafe: if the local state is stale relative to the server (an out-of-band SQL change, a
-- second tab, a profile fetch that hasn't resolved yet), the next edit silently overwrites --
-- not merges -- whatever is actually in the database. This happened for real: a manually
-- backfilled goal_history got replaced by a single stale entry the next time the app recorded
-- any goal edit.
--
-- This function appends atomically against whatever the server's current goal_history actually
-- is, so the client never needs to (and no longer does) read-modify-write the array itself.
create or replace function append_goal_history(p_snapshot jsonb)
returns void
language sql
as $$
  update profiles
  set goal_history = coalesce(goal_history, '[]'::jsonb) || jsonb_build_array(p_snapshot)
  where id = auth.uid();
$$;

grant execute on function append_goal_history(jsonb) to authenticated;
