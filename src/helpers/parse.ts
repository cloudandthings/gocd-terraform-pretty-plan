import { Action, ResourceId, Plan, ChangeType, Diff , RawResource, RawChanges} from '@/helpers/interfaces'
import { equal }  from '@/helpers/equal'

export function parse(terraformPlan: any): Plan {

    const resourceChanges = terraformPlan.resource_changes;

    const removeNop = resourceChanges.filter( (resource:any) => !resource.change.actions.includes("no-op"));

    const actions: Action[] = removeNop.map( (resource:any) => {
        const id:ResourceId = parseId(resource);

        const type:ChangeType = parseChangeType(resource.change.actions);

        const changes:Diff[] = parseChanges(resource.change);

        return { id, type, changes };
    });

    const plan = { warnings: [], actions };

    console.log(plan)

    return plan;
}

export function parseChangeType(changes: string[]): ChangeType {

    if (changes.includes("no-op")) return ChangeType.Unknown;
    if (changes.includes("read")) return ChangeType.Read;
    if (changes.includes("update")) return ChangeType.Update;

    if (changes.includes("create") && changes.includes("delete")) return ChangeType.Recreate;

    if (changes.includes("create")) return ChangeType.Create;
    if (changes.includes("delete")) return ChangeType.Destroy;

    return ChangeType.Unknown;
}

export function parseId(resource: RawResource): ResourceId {

    const idSegments = resource.address.split('.');
    const resourcePrefixes = idSegments.slice(0, idSegments.length - 2);

    return { name: resource.name, type: resource.type, prefixes: resourcePrefixes };
}

export function parseChanges(changes: RawChanges): Diff[] {

    const propsBefore = changes.before ? Object.keys(changes.before) : [];
    const propsAfter = changes.after ? Object.keys(changes.after) : [];
    const propsAfterUnknown = changes.after ? Object.keys(changes.after_unknown) : [];

    const propsAllObj =  propsBefore.concat(propsAfter).concat(propsAfterUnknown).reduce( (acc:any, property) => {
        const diff:Diff = {property, old: undefined, new: "", forcesNewResource: ""};
        acc[property] = diff;
        return acc;
    }, {});

    const propsAllArr = Object.keys(propsAllObj).map((key) => propsAllObj[key]);

    const props = propsAllArr.reduce((acc, property) => {

        property.old = changes.before ? ( changes.before[property.property] ? changes.before[property.property] : null) : null;
        property.new = changes.after ? ( changes.after[property.property] ? changes.after[property.property] : null) : null;
        property.new = changes.after_unknown ? ( property.new ? property.new : ( changes.after_unknown[property.property] ? '<computed>' : property.new ) ) : property.new;

        if (!equal(property.old,property.new)) acc.push(property);

        return acc;

    }, []);

    return props;
}