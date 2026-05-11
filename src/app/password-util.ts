// Utility for password prompt
let passwordSessionValid = false;
export function promptPassword(): Promise<boolean> {
  const password = 'qwerty';
  return new Promise((resolve) => {
    if (passwordSessionValid) {
      resolve(true);
      return;
    }
    const userInput = prompt('Enter password to proceed:');
    if (userInput === password) {
      passwordSessionValid = true;
      resolve(true);
    } else {
      resolve(false);
    }
  });
}
export function resetPasswordSession() {
  passwordSessionValid = false;
}
