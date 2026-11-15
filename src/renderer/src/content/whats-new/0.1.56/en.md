## More reliable workflows in organizations

- **Deploy tags in organizations:** the **Tag de deploy** field of organization workflows lists the repository tags again. If the tags can't be listed, North shows the error instead of "no tags"
- **Passwordless sudo:** on servers with passwordless sudo, steps that use sudo no longer ask for the password
- **Failures no longer pass silently:** steps with a Git or sudo password that used to fail without notice now show the command error and the workflow fails. If a workflow starts failing, it is a real server failure that used to stay hidden

See the [Workflows](workflows) chapter in the manual.
