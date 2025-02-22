export function generateCustomId(): string {
    const now = new Date();
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    
    // Generate random letters and numbers
    const randomLetters = Array.from(
        { length: 2 }, 
        () => letters[Math.floor(Math.random() * letters.length)]
    ).join('');
    const randomNumbers = Array.from(
        { length: 2 }, 
        () => numbers[Math.floor(Math.random() * numbers.length)]
    ).join('');
    
    // Format date string
    const dateString = now.toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).replace(/(\d+)\/(\d+)\/(\d+),\s(\d+):(\d+)/, '$3-$1-$2_$4:$5');
    
    return `${dateString}__${randomLetters}${randomNumbers}`;
} 