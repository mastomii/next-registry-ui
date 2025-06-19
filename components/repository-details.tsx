'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ArrowLeft,
  Tag,
  Calendar,
  HardDrive,
  Monitor,
  Copy,
  Trash2,
  RefreshCw,
  Package,
  Shield,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { Tag as TagType } from '@/lib/registry-api';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface RepositoryDetailsProps {
  repositoryName: string;
  onBack: () => void;
}

export default function RepositoryDetails({ repositoryName, onBack }: RepositoryDetailsProps) {
  const { registryApi } = useAuth();
  const [tags, setTags] = useState<TagType[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTag, setSelectedTag] = useState<TagType | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tagToDelete, setTagToDelete] = useState<TagType | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [registryHost, setRegistryHost] = useState('');

  useEffect(() => {
    fetch('/api/env')
      .then((res) => res.json())
      .then((data) => setRegistryHost(data.registryHost));
  }, []);

  useEffect(() => {
    loadTags();
  }, [repositoryName]);

  const loadTags = async () => {
    if (!registryApi) return;

    setLoading(true);
    try {
      const tagNames = await registryApi.getRepositoryTags(repositoryName);

      const authRaw = localStorage.getItem('registry_auth');
      if (!authRaw) {
        throw new Error('No authentication found');
      }

      const auth = JSON.parse(authRaw);

      const response = await fetch('/api/tag-details', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repository: repositoryName,
          tags: tagNames,
          auth,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get tag details');
      }

      const { tags: tagDetails } = await response.json();
      setTags(tagDetails);
    } catch (error) {
      toast.error('Failed to load repository tags');
      console.error('Error loading tags:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const handleDeleteClick = (tag: TagType) => {
    setTagToDelete(tag);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!registryApi || !tagToDelete?.digest) {
      toast.error('Cannot delete tag: missing digest');
      return;
    }

    setDeleting(true);
    try {
      await registryApi.deleteManifest(repositoryName, tagToDelete.digest);
      toast.success(`Tag ${tagToDelete.name} deleted successfully`);
      setDeleteDialogOpen(false);
      setTagToDelete(null);
      loadTags();
    } catch (error) {
      toast.error('Failed to delete tag');
      console.error('Error deleting tag:', error);
    } finally {
      setDeleting(false);
    }
  };

  const cleanedRegistryHost = registryHost.replace('https://', '') || 'your-private-registry';
  const dockerPullCommand = selectedTag
    ? `docker pull ${cleanedRegistryHost}/${repositoryName}:${selectedTag.name}`
    : `docker pull ${cleanedRegistryHost}/${repositoryName}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="text-slate-400 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Repositories
        </Button>

        <div className="flex items-center space-x-2">
          <Package className="w-6 h-6 text-blue-400" />
          <h1 className="text-2xl font-bold text-white">{repositoryName}</h1>
        </div>

        <Badge variant="secondary" className="bg-slate-700 text-slate-300">
          Private
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tags List */}
        <div className="lg:col-span-2">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white flex items-center space-x-2">
                  <Tag className="w-5 h-5" />
                  <span>Tags ({tags.length})</span>
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadTags}
                  disabled={loading}
                  className="text-slate-400 hover:text-white"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin text-blue-400" />
                </div>
              ) : tags.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Package className="w-12 h-12 mx-auto mb-4 text-slate-600" />
                  <p>No tags found in this repository</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {tags.map((tag) => (
                    <div
                      key={tag.name}
                      className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 ${selectedTag?.name === tag.name
                        ? 'bg-blue-500/10 border-blue-500/50'
                        : 'bg-slate-700/50 border-slate-600 hover:border-slate-500'
                        }`}
                      onClick={() => setSelectedTag(tag)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                          <div>
                            <p className="text-white font-medium">{tag.name}</p>
                            <div className="flex items-center space-x-4 text-sm text-slate-400">
                              <span className="flex items-center space-x-1">
                                <HardDrive className="w-3 h-3" />
                                <span>{formatSize(tag.size)}</span>
                              </span>
                              <span className="flex items-center space-x-1">
                                <Calendar className="w-3 h-3" />
                                <span>{formatDistanceToNow(new Date(tag.created), { addSuffix: true })}</span>
                              </span>
                              {tag.architecture && (
                                <span className="flex items-center space-x-1">
                                  <Monitor className="w-3 h-3" />
                                  <span>{tag.architecture}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(`${repositoryName}:${tag.name}`);
                            }}
                            className="text-slate-400 hover:text-blue-400"
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClick(tag);
                            }}
                            className="text-slate-400 hover:text-red-400"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Repository Info */}
        <div className="space-y-6">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Docker Pull Command</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <code className="block p-3 bg-slate-900 rounded-lg text-sm text-green-400 pr-10 break-all">
                  {dockerPullCommand}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2 text-slate-400 hover:text-white"
                  onClick={() => copyToClipboard(dockerPullCommand)}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {selectedTag && (
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Tag Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-slate-400">Tag Name</p>
                  <p className="text-white font-mono">{selectedTag.name}</p>
                </div>

                <Separator className="bg-slate-700" />

                <div>
                  <p className="text-sm text-slate-400">Digest</p>
                  <p className="text-white font-mono text-xs break-all">
                    {selectedTag.digest || 'N/A'}
                  </p>
                </div>

                <Separator className="bg-slate-700" />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-400">Total Size</p>
                    <p className="text-white font-semibold">{formatSize(selectedTag.size)}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {selectedTag.size.toLocaleString()} bytes
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Created</p>
                    <p className="text-white text-sm">
                      {formatDistanceToNow(new Date(selectedTag.created), { addSuffix: true })}
                    </p>
                  </div>
                </div>

                {(selectedTag.architecture || selectedTag.os) && (
                  <>
                    <Separator className="bg-slate-700" />
                    <div className="grid grid-cols-2 gap-4">
                      {selectedTag.architecture && (
                        <div>
                          <p className="text-sm text-slate-400">Architecture</p>
                          <p className="text-white">{selectedTag.architecture}</p>
                        </div>
                      )}
                      {selectedTag.os && (
                        <div>
                          <p className="text-sm text-slate-400">OS</p>
                          <p className="text-white">{selectedTag.os}</p>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center space-x-2">
                <Shield className="w-5 h-5" />
                <span>Security</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Visibility</span>
                  <Badge variant="secondary" className="bg-slate-700 text-slate-300">
                    Private
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Registry</span>
                  <span className="text-white text-sm">Self-hosted</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-slate-800 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <span>Delete Tag</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Are you sure you want to delete the tag <span className="font-mono text-white">"{tagToDelete?.name}"</span>?
              <br />
              <br />
              This action cannot be undone and will permanently remove this image tag from the registry.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="bg-slate-700 text-slate-300 hover:bg-slate-600 border-slate-600"
              disabled={deleting}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Tag
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}