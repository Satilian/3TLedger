function PersonalDetails() {
  return (
    <section>
      <h2>Personal details</h2>
      <p>Personal details are coming soon.</p>
    </section>
  );
}

function Settings() {
  return (
    <section>
      <h2>Settings</h2>
      <p>Account settings are coming soon.</p>
    </section>
  );
}

function Notifications() {
  return (
    <section>
      <h2>Notifications</h2>
      <p>Notification preferences are coming soon.</p>
    </section>
  );
}

function Privacy() {
  return (
    <section>
      <h2>Privacy & security</h2>
      <p>Privacy and security settings are coming soon.</p>
    </section>
  );
}

function Billing() {
  return (
    <section>
      <h2>Billing</h2>
      <p>Billing details are coming soon.</p>
    </section>
  );
}

function HelpSupport() {
  return (
    <section>
      <h2>Help & support</h2>
      <p>Support options are coming soon.</p>
    </section>
  );
}

export function Profile() {
  return (
    <>
      <h1>Profile</h1>
      <PersonalDetails />
      <Settings />
      <Notifications />
      <Privacy />
      <Billing />
      <HelpSupport />
    </>
  );
}
