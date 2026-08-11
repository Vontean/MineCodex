#import <Foundation/Foundation.h>

#include <fcntl.h>
#include <sys/stat.h>
#include <unistd.h>

static NSString *requiredString(NSDictionary *configuration, NSString *key) {
    id value = configuration[key];
    return [value isKindOfClass:NSString.class] && [value length] > 0 ? value : nil;
}

static int redirectFileDescriptor(int target, NSString *path) {
    int descriptor = open(path.fileSystemRepresentation, O_WRONLY | O_CREAT | O_APPEND, 0600);
    if (descriptor < 0) return -1;
    int result = dup2(descriptor, target);
    close(descriptor);
    return result;
}

int main(void) {
    @autoreleasepool {
        umask(0077);
        NSString *configurationPath = [NSHomeDirectory()
            stringByAppendingPathComponent:@"Library/Application Support/MineCodex/service-runtime.plist"];
        NSData *data = [NSData dataWithContentsOfFile:configurationPath];
        NSError *error = nil;
        id propertyList = data == nil ? nil : [NSPropertyListSerialization
            propertyListWithData:data
            options:NSPropertyListImmutable
            format:nil
            error:&error];
        if (![propertyList isKindOfClass:NSDictionary.class]) {
            fprintf(stderr, "MineCodex service configuration could not be read from %s: %s\n",
                    configurationPath.fileSystemRepresentation,
                    error.localizedDescription.UTF8String ?: "invalid property list");
            return 78;
        }

        NSDictionary *configuration = propertyList;
        NSString *nodePath = requiredString(configuration, @"NodePath");
        NSString *cliPath = requiredString(configuration, @"CLIPath");
        NSString *standardOutputPath = requiredString(configuration, @"StandardOutputPath");
        NSString *standardErrorPath = requiredString(configuration, @"StandardErrorPath");
        NSString *pathValue = requiredString(configuration, @"Path");
        if (nodePath == nil || cliPath == nil || standardOutputPath == nil
                || standardErrorPath == nil || pathValue == nil) {
            fprintf(stderr, "MineCodex service configuration is incomplete.\n");
            return 78;
        }

        if (redirectFileDescriptor(STDOUT_FILENO, standardOutputPath) < 0
                || redirectFileDescriptor(STDERR_FILENO, standardErrorPath) < 0) {
            fprintf(stderr, "MineCodex service logs could not be opened.\n");
            return 73;
        }

        setenv("PATH", pathValue.UTF8String, 1);
        setenv("MINECODEX_SERVICE_HOST", "1", 1);
        const char *node = nodePath.fileSystemRepresentation;
        const char *cli = cliPath.fileSystemRepresentation;
        char *const arguments[] = {
            (char *)node,
            (char *)cli,
            "serve",
            "--service",
            NULL,
        };
        execv(node, arguments);
        fprintf(stderr, "MineCodex service could not launch Node.js at %s: %s\n", node, strerror(errno));
        return 69;
    }
}
