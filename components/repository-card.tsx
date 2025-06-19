'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  Package,
  Tag,
  Calendar,
  HardDrive,
  ChevronRight,
  Trash2,
  Eye,
  Download,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { Repository } from '@/lib/registry-api';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface RepositoryCardProps {
  repository: Repository;
  onViewDetails: (name: string) => void;
  onDelete?: (name: string) => void;
  onRefresh?: () => void;
}

export default function RepositoryCard({
  repository,
  onViewDetails,
  onDelete,
  onRefresh
}: RepositoryCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const formatSize = (bytes?: number) => {
    if (typeof bytes !== 'number' || isNaN(bytes)) return 'Unknown';
    if (bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const formattedSize = (bytes / Math.pow(1024, i)).toFixed(2);
    return `${formattedSize} ${sizes[i]}`;
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    
    try {
      // Get auth from localStorage
      const authRaw = localStorage.getItem('registry_auth');
      if (!authRaw) {
        throw new Error('No authentication found');
      }

      const auth = JSON.parse(authRaw);

      const response = await fetch(`/api/registry/repositories/${repository.name}/delete`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ auth }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast.success(
          `Repository "${repository.name}" deleted successfully`,
          {
            description: `${result.deletedTags} tags removed. ${result.note}`,
            duration: 5000,
          }
        );
        
        // Call onDelete callback if provided
        if (onDelete) {
          onDelete(repository.name);
        }
        
        // Refresh the repository list
        if (onRefresh) {
          onRefresh();
        }
      } else {
        // Show detailed error information
        const errorDetails = result.errors?.length > 0 
          ? `Errors: ${result.errors.slice(0, 3).join(', ')}${result.errors.length > 3 ? '...' : ''}`
          : result.error || 'Unknown error occurred';
          
        toast.error(
          `Failed to delete repository "${repository.name}"`,
          {
            description: errorDetails,
            duration: 8000,
          }
        );
        
        // If partial success, still refresh to show updated state
        if (result.deletedTags > 0 && onRefresh) {
          onRefresh();
        }
      }
    } catch (error) {
      console.error('Error deleting repository:', error);
      toast.error(
        `Failed to delete repository "${repository.name}"`,
        {
          description: error instanceof Error ? error.message : 'Network error occurred',
          duration: 5000,
        }
      );
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  return (
    <>
      <Card
        className="bg-slate-800 border-slate-700 hover:border-blue-500/50 transition-all duration-200 cursor-pointer group"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => onViewDetails(repository.name)}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-2">
              <Package className="w-5 h-5 text-blue-400" />
              <CardTitle className="text-white text-lg font-semibold truncate">
                {repository.name}
              </CardTitle>
            </div>
            <ChevronRight
              className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${
                isHovered ? 'transform translate-x-1' : ''
              }`}
            />
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-4 text-slate-400">
                {repository.tags && (
                  <div className="flex items-center space-x-1">
                    <Tag className="w-4 h-4" />
                    <span>{repository.tags.length} tags</span>
                  </div>
                )}

                {typeof repository.size === 'number' && (
                  <div className="flex items-center space-x-1">
                    <HardDrive className="w-4 h-4" />
                    <span>{formatSize(repository.size)}</span>
                  </div>
                )}

                {repository.pullCount && (
                  <div className="flex items-center space-x-1">
                    <Download className="w-4 h-4" />
                    <span>{repository.pullCount}</span>
                  </div>
                )}
              </div>
            </div>

            {repository.lastUpdated && (
              <div className="flex items-center space-x-1 text-xs text-slate-500">
                <Calendar className="w-3 h-3" />
                <span>
                  Updated{' '}
                  {formatDistanceToNow(new Date(repository.lastUpdated), {
                    addSuffix: true
                  })}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <Badge variant="secondary" className="bg-slate-700 text-slate-300">
                Private
              </Badge>

              <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-slate-400 hover:text-blue-400"
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewDetails(repository.name);
                  }}
                >
                  <Eye className="w-4 h-4" />
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  className="text-slate-400 hover:text-red-400"
                  onClick={handleDeleteClick}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-slate-800 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <span>Delete Repository</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Are you sure you want to delete the repository{' '}
              <span className="font-mono text-white">"{repository.name}"</span>?
              <br />
              <br />
              <div className="bg-slate-900 p-3 rounded-lg text-sm">
                <div className="text-yellow-400 font-medium mb-2">⚠️ This will:</div>
                <ul className="space-y-1 text-slate-300">
                  <li>• Delete all {repository.tags?.length || 0} tags</li>
                  <li>• Remove all manifests and metadata</li>
                  <li>• Make the repository completely empty</li>
                </ul>
                <div className="mt-2 text-xs text-slate-500">
                  Note: Blob storage will be reclaimed after garbage collection runs on the registry server.
                </div>
              </div>
              <br />
              <strong className="text-red-400">This action cannot be undone.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="bg-slate-700 text-slate-300 hover:bg-slate-600 border-slate-600"
              disabled={isDeleting}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Repository
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}