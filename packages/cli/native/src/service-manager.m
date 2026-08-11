#import <Foundation/Foundation.h>
#import <ServiceManagement/ServiceManagement.h>

static NSString *const MineCodexServicePlist = @"com.vontean.minecodex.background.plist";

static const char *statusName(SMAppServiceStatus status) {
    switch (status) {
        case SMAppServiceStatusNotRegistered: return "not-registered";
        case SMAppServiceStatusEnabled: return "enabled";
        case SMAppServiceStatusRequiresApproval: return "requires-approval";
        case SMAppServiceStatusNotFound: return "not-found";
    }
    return "unknown";
}

static void printStatus(SMAppService *service) {
    printf("status=%s\n", statusName(service.status));
}

int main(int argc, const char *argv[]) {
    @autoreleasepool {
        if (argc != 2) {
            fprintf(stderr, "usage: MineCodexServiceManager register|unregister|status\n");
            return 64;
        }

        SMAppService *service = [SMAppService agentServiceWithPlistName:MineCodexServicePlist];
        NSString *command = [NSString stringWithUTF8String:argv[1]];

        if ([command isEqualToString:@"status"]) {
            printStatus(service);
            return 0;
        }

        NSError *error = nil;
        if ([command isEqualToString:@"register"]) {
            if (service.status == SMAppServiceStatusEnabled) {
                printStatus(service);
                return 0;
            }
            if (![service registerAndReturnError:&error]) {
                fprintf(stderr, "MineCodex background service could not be registered: %s\n",
                        error.localizedDescription.UTF8String);
                printStatus(service);
                return 1;
            }
            printStatus(service);
            return 0;
        }

        if ([command isEqualToString:@"unregister"]) {
            if (service.status == SMAppServiceStatusNotRegistered
                    || service.status == SMAppServiceStatusNotFound) {
                printStatus(service);
                return 0;
            }
            dispatch_semaphore_t completion = dispatch_semaphore_create(0);
            __block NSError *unregisterError = nil;
            [service unregisterWithCompletionHandler:^(NSError *result) {
                unregisterError = result;
                dispatch_semaphore_signal(completion);
            }];
            dispatch_semaphore_wait(completion, DISPATCH_TIME_FOREVER);
            if (unregisterError != nil) {
                fprintf(stderr, "MineCodex background service could not be unregistered: %s\n",
                        unregisterError.localizedDescription.UTF8String);
                printStatus(service);
                return 1;
            }
            printStatus(service);
            return 0;
        }

        fprintf(stderr, "usage: MineCodexServiceManager register|unregister|status\n");
        return 64;
    }
}
