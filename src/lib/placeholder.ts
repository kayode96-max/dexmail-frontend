
export const getPlaceholderImage = (text: string = 'No Image') => {
    const svg = `
    <svg width="300" height="300" viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
      <rect width="300" height="300" fill="#f0f0f0"/>
      <text x="50%" y="50%" font-family="sans-serif" font-size="24" text-anchor="middle" dy=".3em" fill="#888">${text}</text>
    </svg>
  `;
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
};
