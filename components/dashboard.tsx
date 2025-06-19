'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Package,
  HardDrive,
  Download,
  Server,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { Repository } from '@/lib/registry-api';
import DashboardHeader from './dashboard-header';
import RepositoryCard from './repository-card';
import RepositoryDetails from './repository-details';
import { toast } from 'sonner';

export default function Dashboard() {
  const { registryApi } = useAuth();
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [filteredRepositories, setFilteredRepositories] = useState<Repository[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedRepository, setSelectedRepository] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalRepositories: 0,
    totalTags: 0,
    totalSize: 0,
  });

  useEffect(() => {
    loadRepositories();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredRepositories(repositories);
    } else {
      const filtered = repositories.filter(repo =>
        repo.name.toLowerCase().includes(searchTerm.toLowerCase().trim())
      );
      setFilteredRepositories(filtered);
    }
  }, [repositories, searchTerm]);

  const formatSize = (bytes?: number) => {
    if (typeof bytes !== 'number' || isNaN(bytes)) return 'Unknown';
    if (bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const formattedSize = (bytes / Math.pow(1024, i)).toFixed(2);
    return `${formattedSize} ${sizes[i]}`;
  };

  const loadRepositories = async () => {
    if (!registryApi) return;

    setLoading(true);
    try {
      // Get basic repository list
      const repos = await registryApi.getRepositories();
      console.log('Basic repositories:', repos);

      // Get auth from localStorage
      const authRaw = localStorage.getItem('registry_auth');
      if (!authRaw) {
        throw new Error('No authentication found');
      }

      const auth = JSON.parse(authRaw);

      // Use our new API to get enhanced repository info
      const response = await fetch('/api/registry-info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repositories: repos,
          auth,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get repository info');
      }

      const { repositories: enhancedRepos } = await response.json();
      console.log('Enhanced repositories:', enhancedRepos);

      setRepositories(enhancedRepos);

      // Calculate stats
      const totalTags = enhancedRepos.reduce((sum: number, repo: Repository) => sum + (repo.tags?.length || 0), 0);
      const totalSize = enhancedRepos.reduce((sum: number, repo: Repository) => sum + (repo.size || 0), 0);
      
      setStats({
        totalRepositories: enhancedRepos.length,
        totalTags,
        totalSize,
      });

      console.log('Stats:', { totalRepositories: enhancedRepos.length, totalTags, totalSize });
    } catch (error) {
      toast.error('Failed to load repositories');
      console.error('Error loading repositories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRepository = async (repositoryName: string) => {
    // Remove the repository from the local state immediately for better UX
    setRepositories(prev => prev.filter(repo => repo.name !== repositoryName));
    
    // Update stats
    const deletedRepo = repositories.find(repo => repo.name === repositoryName);
    if (deletedRepo) {
      setStats(prev => ({
        totalRepositories: prev.totalRepositories - 1,
        totalTags: prev.totalTags - (deletedRepo.tags?.length || 0),
        totalSize: prev.totalSize - (deletedRepo.size || 0),
      }));
    }
  };

  if (selectedRepository) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
        <DashboardHeader searchTerm={searchTerm} onSearchChange={setSearchTerm} />
        <div className="container mx-auto px-4 py-8">
          <RepositoryDetails
            repositoryName={selectedRepository}
            onBack={() => setSelectedRepository(null)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      <DashboardHeader searchTerm={searchTerm} onSearchChange={setSearchTerm} />
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Repositories</p>
                  <p className="text-2xl font-bold text-white">{stats.totalRepositories}</p>
                </div>
                <Package className="w-8 h-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Total Tags</p>
                  <p className="text-2xl font-bold text-white">{stats.totalTags}</p>
                </div>
                <Server className="w-8 h-8 text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Storage</p>
                  <p className="text-2xl font-bold text-white">{formatSize(stats.totalSize)}</p>
                </div>
                <HardDrive className="w-8 h-8 text-purple-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Registry Status</p>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    <span className="text-white font-medium">Online</span>
                  </div>
                </div>
                <Download className="w-8 h-8 text-orange-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white">
                Repositories
                {searchTerm && (
                  <span className="text-sm font-normal text-slate-400 ml-2">
                    ({filteredRepositories.length} of {repositories.length})
                  </span>
                )}
              </CardTitle>
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadRepositories}
                  disabled={loading}
                  className="text-slate-400 hover:text-white"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-400" />
              </div>
            ) : filteredRepositories.length === 0 ? (
              <div className="text-center py-12">
                {searchTerm ? (
                  <div className="text-slate-400">
                    <AlertCircle className="w-12 h-12 mx-auto mb-4 text-slate-600" />
                    <p>No repositories found matching "{searchTerm}"</p>
                    <p className="text-sm mt-2">Try adjusting your search terms</p>
                  </div>
                ) : (
                  <div className="text-slate-400">
                    <Package className="w-12 h-12 mx-auto mb-4 text-slate-600" />
                    <p>No repositories found in this registry</p>
                    <p className="text-sm mt-2">Push your first image to get started</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredRepositories.map((repository) => (
                  <RepositoryCard
                    key={repository.name}
                    repository={repository}
                    onViewDetails={setSelectedRepository}
                    onDelete={handleDeleteRepository}
                    onRefresh={loadRepositories}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}