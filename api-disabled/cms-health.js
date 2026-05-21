export default function handler(req, res) {
  res.json({
    cms: true,
    backend: 'GitHub API',
    repo: '1v1mebraskies-svg/CODELOOT',
    branch: 'main',
    writes: ['data/games.json', 'assets/img/*'],
    deployment: 'GitHub Pages (automatic)',
  });
}
